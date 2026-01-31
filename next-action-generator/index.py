"""
Next Action Generator Lambda Handler

This module generates actionable next steps based on review results
using Strands Agent with optional tool configurations.
"""
import json
import os
from typing import Any, Dict

from bedrock_agentcore import BedrockAgentCoreApp
from logger import set_logger, logger

# AgentCore App initialization
app = BedrockAgentCoreApp()
set_logger(app.logger)

# Import agent after logger is initialized
from agent import process_next_action
from s3_temp_utils import S3TempStorage

# Environment variables
TEMP_BUCKET = os.environ.get("TEMP_BUCKET", "")
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-west-2")


@app.entrypoint
def handler(event, context):
    """
    Lambda handler for generating next actions using Strands Agent.

    Event structure:
    {
        "reviewJobId": "job-id",
        "promptTemplate": {
            "id": "template-id",
            "prompt": "template content with {{variables}}"
        },
        "templateData": {
            "failedItems": [...],
            "userOverrides": [...],
            "allResults": [...],
            "documents": [...],
            "checklistName": "name",
            "passCount": 10,
            "failCount": 2
        },
        "toolConfiguration": {
            "knowledgeBase": [...],
            "codeInterpreter": true,
            "mcpConfig": {...}
        }
    }
    """
    logger.info(f"[NextActionGenerator] Received event: {json.dumps(event)}")

    # Log session and trace information from context
    session_id = getattr(context, "session_id", "N/A")
    request_headers = getattr(context, "request_headers", {})
    trace_id = request_headers.get("X-Amzn-Trace-Id", "N/A")

    logger.info(f"AgentCore Session ID: {session_id}")
    logger.info(f"X-Amzn-Trace-Id: {trace_id}")
    logger.info(f"reviewJobId: {event.get('reviewJobId', 'N/A')}")

    # Check required environment variables
    required_vars = ["BEDROCK_REGION"]
    missing_vars = [var for var in required_vars if not os.environ.get(var)]
    if missing_vars:
        logger.error(
            f"[NextActionGenerator] Missing required environment variables: {', '.join(missing_vars)}"
        )
        return {
            "status": "error",
            "message": f"Missing required environment variables: {', '.join(missing_vars)}",
        }

    # Extract parameters from the event
    review_job_id = event.get("reviewJobId", "")
    prompt_template = event.get("promptTemplate", {})
    template_data = event.get("templateData", {})
    tool_configuration = event.get("toolConfiguration")

    if not prompt_template.get("prompt"):
        raise ValueError("Missing prompt template")

    logger.info(f"[NextActionGenerator] Processing next action for job: {review_job_id}")

    try:
        # Process next action generation
        result = process_next_action(
            prompt_template=prompt_template,
            template_data=template_data,
            tool_configuration=tool_configuration,
        )

        logger.info(f"[NextActionGenerator] Generation complete with status: {result.get('status')}")

        # Store large data in S3 and return reference
        s3_temp = S3TempStorage(TEMP_BUCKET)
        return s3_temp.store(result)

    except Exception as e:
        logger.error(f"[NextActionGenerator] Error processing next action for job {review_job_id}: {str(e)}")
        raise e
