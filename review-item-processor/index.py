import json
import os
from typing import Any, Dict, List, Optional

import boto3
from bedrock_agentcore import BedrockAgentCoreApp
from logger import set_logger, logger

# AgentCore App initialization
app = BedrockAgentCoreApp()
set_logger(app.logger)

# Import agent after logger is initialized
from agent import DOCUMENT_MODEL_ID, process_review
from s3_temp_utils import S3TempStorage

# Environment variables
DOCUMENT_BUCKET = os.environ.get("DOCUMENT_BUCKET", "")
TEMP_BUCKET = os.environ.get("TEMP_BUCKET", "")


@app.entrypoint
def handler(event, context):
    """
    Lambda handler for the review item processor using Strands and MCP.

    Event structure:
    {
        "reviewJobId": "job-id",
        "checkId": "check-id",
        "reviewResultId": "result-id",
        "documentPaths": ["s3-path-1", "s3-path-2"],
        "checkName": "check name",
        "checkDescription": "check description",
        "languageName": "language name"
    }
    """
    # 生の event 全体（toolConfiguration の MCP 秘密・headers/env を含みうる）を
    # ログに出さない。相関に必要な非機微スカラのみを記録する
    # （詳細な相関 ID は直後の info ログで出力）。
    logger.info(
        "[Strands MCP] Received event "
        f"(reviewJobId={event.get('reviewJobId', 'N/A')}, "
        f"reviewResultId={event.get('reviewResultId', 'N/A')}, "
        f"checkId={event.get('checkId', 'N/A')}, "
        f"documentPaths={len(event.get('documentPaths', []) or [])})"
    )

    # Log session and trace information from context
    # bedrock-agentcore 1.x では RequestContext.request_headers は「属性は常に
    # 存在するが値は None になり得る」Optional フィールドのため、getattr の
    # デフォルト値では None を防げない。`or {}` で None を空 dict に正規化する
    # （0.1.0 は属性自体が無く getattr のデフォルトが効いていた）。
    # In bedrock-agentcore 1.x, RequestContext.request_headers is an Optional
    # field: the attribute always exists but may be None, so getattr's default
    # alone no longer protects the .get() below. Normalize None with `or {}`.
    session_id = getattr(context, 'session_id', 'N/A')
    request_headers = getattr(context, 'request_headers', None) or {}
    trace_id = request_headers.get('X-Amzn-Trace-Id', 'N/A')
    
    logger.info(f"AgentCore Session ID: {session_id}")
    logger.info(f"X-Amzn-Trace-Id: {trace_id}")
    logger.info(f"reviewJobId: {event.get('reviewJobId', 'N/A')}")
    logger.info(f"reviewResultId: {event.get('reviewResultId', 'N/A')}")
    logger.info(f"checkId: {event.get('checkId', 'N/A')}")

    # Check required environment variables
    required_vars = ["DOCUMENT_BUCKET"]
    missing_vars = [var for var in required_vars if not os.environ.get(var)]
    if missing_vars:
        logger.error(
            f"[Strands MCP] Missing required environment variables: {', '.join(missing_vars)}"
        )
        return {
            "status": "error",
            "message": f"Missing required environment variables: {', '.join(missing_vars)}",
        }

    # Extract parameters from the event
    review_job_id = event.get("reviewJobId", "")
    check_id = event.get("checkId", "")
    review_result_id = event.get("reviewResultId", "")
    document_paths = event.get("documentPaths", [])
    check_name = event.get("checkName", "")
    check_description = event.get("checkDescription", "")
    language_name = event.get("languageName", "日本語")

    if not document_paths:
        raise ValueError("Missing document paths")

    logger.info(
        f"[Strands MCP] Processing review item: {review_result_id} for check: {check_id}"
    )

    try:
        # Process review with tool configuration
        # The agent.py will automatically detect file types and select the appropriate model
        # Extract tool configuration if available
        tool_configuration = event.get("toolConfiguration")
        model_id_override = event.get("modelId")
        # toolConfiguration には MCP 資格情報（headers/env）が含まれうるため、
        # 値をシリアライズしない。有無とトップレベルキーのみを記録する。
        if isinstance(tool_configuration, dict):
            logger.debug(
                f"[DEBUG LAMBDA] Tool configuration present; "
                f"keys={sorted(tool_configuration.keys())}"
            )
        else:
            logger.debug(
                f"[DEBUG LAMBDA] Tool configuration present={tool_configuration is not None}"
            )
        if model_id_override:
            logger.info(f"[DEBUG LAMBDA] Per-item model override: {model_id_override}")

        review_data = process_review(
            document_bucket=DOCUMENT_BUCKET,
            document_paths=document_paths,
            check_name=check_name,
            check_description=check_description,
            language_name=language_name,
            model_id=model_id_override,
            toolConfiguration=tool_configuration,
        )

        # Return results to Step Functions - handle both PDF and image results
        result = {
            "status": "success",
            "result": review_data.get("result", "fail"),
            "confidence": review_data.get("confidence", 0.0),
            "explanation": review_data.get("explanation", ""),
            "shortExplanation": review_data.get("shortExplanation", ""),
            "reviewMeta": review_data.get("reviewMeta"),
            "inputTokens": review_data.get("inputTokens"),
            "outputTokens": review_data.get("outputTokens"),
            "totalCost": review_data.get("totalCost"),
        }

        # Handle PDF-specific fields
        if "extractedText" in review_data:
            result["extractedText"] = review_data["extractedText"]
            result["pageNumber"] = review_data.get("pageNumber", 1)

        # Handle image-specific fields
        if "usedImageIndexes" in review_data:
            result["usedImageIndexes"] = review_data["usedImageIndexes"]

        if "boundingBoxes" in review_data:
            result["boundingBoxes"] = review_data["boundingBoxes"]

        # Common field for both types
        if "verificationDetails" in review_data:
            result["verificationDetails"] = review_data["verificationDetails"]

        logger.info(f"[Strands MCP] Review complete with result: {result['result']}")
        
        # 🎯 大きなデータをS3に保存して参照情報を返す
        s3_temp = S3TempStorage(TEMP_BUCKET)
        return s3_temp.store(result)

    except Exception as e:
        logger.error(f"[Strands MCP] Error processing review item {review_result_id}: {str(e)}")
        raise e
