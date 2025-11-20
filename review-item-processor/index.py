import json
import os
from typing import Any, Dict, List, Optional

import boto3
from bedrock_agentcore import BedrockAgentCoreApp
from agent import DOCUMENT_MODEL_ID, process_review
from s3_temp_utils import S3TempStorage
from logger import set_logger, logger

# AgentCore App initialization
app = BedrockAgentCoreApp()
set_logger(app.logger)

# Environment variables
DOCUMENT_BUCKET = os.environ.get("DOCUMENT_BUCKET", "")
TEMP_BUCKET = os.environ.get("TEMP_BUCKET", "")
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-west-2")


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
    logger.info(f"[Strands MCP] Received event: {json.dumps(event)}")

    # Check required environment variables
    required_vars = ["DOCUMENT_BUCKET", "BEDROCK_REGION"]
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
        # Process review with MCP tools using our Strands agent
        # The agent.py will automatically detect file types and select the appropriate model
        # Extract MCP servers configuration if available
        mcp_servers = event.get("mcpServers", [])
        logger.debug(f"[DEBUG LAMBDA] MCP servers configuration: {json.dumps(mcp_servers)}")

        review_data = process_review(
            document_bucket=DOCUMENT_BUCKET,
            document_paths=document_paths,
            check_name=check_name,
            check_description=check_description,
            language_name=language_name,
            model_id=DOCUMENT_MODEL_ID,  # Default model, will be overridden for images
            mcpServers=mcp_servers,
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
