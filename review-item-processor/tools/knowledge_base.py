import logging
import os
from typing import Any, Dict, List, NotRequired, Optional, TypedDict

import boto3
from strands.tools import tool
from strands.types.tools import AgentTool

logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get("AWS_REGION", "us-west-2")


class KnowledgeBaseConfig(TypedDict):
    """
    Knowledge Base configuration.

    Attributes:
        knowledge_base_id: Bedrock Knowledge Base ID (required)
        data_source_ids: Optional list of data source IDs to filter
    """

    knowledge_base_id: str
    data_source_ids: NotRequired[list[str]]


# Knowledge Base Configuration
# To enable the knowledge base tool, configure one or more knowledge bases below.
# Each knowledge base can optionally filter by specific data source IDs.
#
# Example configuration:
# KNOWLEDGE_BASE_CONFIG: list[KnowledgeBaseConfig] = [
#     {
#         "knowledge_base_id": "ABCD1234",           # Required: Your KB ID
#         "data_source_ids": ["DS001", "DS002"]      # Optional: Filter by data sources
#     },
#     {
#         "knowledge_base_id": "EFGH5678"            # KB without data source filter
#     }
# ]
#
# How to use:
# 1. Get your Knowledge Base ID from AWS Bedrock console
# 2. (Optional) Get Data Source IDs if you want to filter specific sources
# 3. Uncomment and configure KNOWLEDGE_BASE_CONFIG below
# 4. The tool will be automatically enabled when config is not empty
#
KNOWLEDGE_BASE_CONFIG: list[KnowledgeBaseConfig] = [
    {"knowledge_base_id": "JYKDHBFHTN", "data_source_ids": ["LP4GFWLFJE"]}
]


def create_knowledge_base_tool() -> Optional[AgentTool]:
    """
    Create knowledge base query tool.

    Returns:
        Knowledge base tool function or None if no configuration
    """
    if not KNOWLEDGE_BASE_CONFIG:
        logger.debug("No knowledge base configuration, skipping tool creation")
        return None

    try:
        logger.info(
            f"Creating knowledge base query tool with {len(KNOWLEDGE_BASE_CONFIG)} KB(s)"
        )
        return knowledge_base_query
    except Exception as e:
        logger.error(f"Failed to create knowledge base tool: {e}")
        return None


@tool
def knowledge_base_query(query: str, max_results_per_kb: int = 5) -> dict:
    """
    Query Bedrock Knowledge Bases to retrieve relevant information.

    This tool searches configured knowledge bases and returns relevant
    information to support document review decisions.

    Args:
        query: Natural language query to search for
        max_results_per_kb: Maximum number of results per knowledge base (default: 5)

    Returns:
        Dictionary with status and retrieved content
    """
    try:
        bedrock_agent_runtime = boto3.client(
            "bedrock-agent-runtime", region_name=AWS_REGION
        )

        all_results = []

        for kb_config in KNOWLEDGE_BASE_CONFIG:
            kb_id = kb_config.get("knowledge_base_id")
            data_source_ids = kb_config.get("data_source_ids", [])

            if not kb_id:
                logger.warning("Skipping KB config without knowledge_base_id")
                continue

            try:
                # Build retrieval configuration
                retrieval_config = {
                    "vectorSearchConfiguration": {"numberOfResults": max_results_per_kb}
                }

                # Add data source filter if specified
                if data_source_ids:
                    retrieval_config["vectorSearchConfiguration"]["filter"] = {
                        "in": {
                            "key": "x-amz-bedrock-kb-data-source-id",
                            "value": data_source_ids,
                        }
                    }

                # Execute retrieve API
                response = bedrock_agent_runtime.retrieve(
                    knowledgeBaseId=kb_id,
                    retrievalQuery={"text": query},
                    retrievalConfiguration=retrieval_config,
                )

                # Extract results
                for result in response.get("retrievalResults", []):
                    content = result.get("content", {})
                    location = result.get("location", {})
                    score = result.get("score", 0.0)

                    all_results.append(
                        {
                            "knowledgeBaseId": kb_id,
                            "text": content.get("text", ""),
                            "score": score,
                            "location": _format_location(location),
                            "metadata": result.get("metadata", {}),
                        }
                    )

                logger.debug(
                    f"Retrieved {len(response.get('retrievalResults', []))} results from KB {kb_id}"
                )

            except Exception as e:
                logger.error(f"Error querying KB {kb_id}: {e}")
                all_results.append({"knowledgeBaseId": kb_id, "error": str(e)})

        # Sort by score descending
        all_results.sort(key=lambda x: x.get("score", 0), reverse=True)

        return {
            "status": "success",
            "content": [
                {
                    "json": {
                        "query": query,
                        "totalResults": len(all_results),
                        "results": all_results,
                    }
                }
            ],
        }

    except Exception as e:
        error_msg = f"Knowledge base query failed: {str(e)}"
        logger.error(error_msg)
        return {
            "status": "error",
            "content": [
                {"text": f"An error occurred during knowledge base query: {str(e)}"}
            ],
        }


def _format_location(location: Dict[str, Any]) -> str:
    """Format location information for display"""
    loc_type = location.get("type", "")

    if loc_type == "S3":
        s3_loc = location.get("s3Location", {})
        uri = s3_loc.get("uri", "")
        return uri
    elif loc_type == "WEB":
        web_loc = location.get("webLocation", {})
        return web_loc.get("url", "")
    elif loc_type == "CONFLUENCE":
        conf_loc = location.get("confluenceLocation", {})
        return conf_loc.get("url", "")
    elif loc_type == "SALESFORCE":
        sf_loc = location.get("salesforceLocation", {})
        return sf_loc.get("url", "")
    elif loc_type == "SHAREPOINT":
        sp_loc = location.get("sharePointLocation", {})
        return sp_loc.get("url", "")
    else:
        return f"Unknown location type: {loc_type}"
