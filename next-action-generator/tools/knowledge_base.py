import os
from typing import Any, Dict, List, Optional, TypedDict

import boto3
from logger import logger
from strands.tools import tool
from strands.types.tools import AgentTool

AWS_REGION = os.environ.get("AWS_REGION", "us-west-2")


class KnowledgeBaseConfig(TypedDict):
    knowledgeBaseId: str
    dataSourceIds: Optional[List[str]]


def create_knowledge_base_tool(
    config: List[KnowledgeBaseConfig],
) -> Optional[AgentTool]:
    """
    Create knowledge base query tool with dynamic configuration.

    Args:
        config: Knowledge base configuration from tool settings

    Returns:
        Knowledge base tool function or None if no configuration
    """
    if not config:
        logger.debug("No knowledge base configuration, skipping tool creation")
        return None

    # Capture config in closure
    kb_config = config

    @tool
    def knowledge_base_query(query: str, max_results_per_kb: int = 5) -> dict:
        """Query Bedrock Knowledge Bases to retrieve relevant information."""
        try:
            bedrock_agent_runtime = boto3.client(
                "bedrock-agent-runtime", region_name=AWS_REGION
            )
            all_results = []

            for kb in kb_config:
                kb_id = kb.get("knowledgeBaseId")
                data_source_ids = kb.get("dataSourceIds", [])

                if not kb_id:
                    logger.warning("Skipping KB config without knowledgeBaseId")
                    continue

                try:
                    retrieval_config = {
                        "vectorSearchConfiguration": {
                            "numberOfResults": max_results_per_kb
                        }
                    }

                    if data_source_ids:
                        retrieval_config["vectorSearchConfiguration"]["filter"] = {
                            "in": {
                                "key": "x-amz-bedrock-kb-data-source-id",
                                "value": data_source_ids,
                            }
                        }

                    response = bedrock_agent_runtime.retrieve(
                        knowledgeBaseId=kb_id,
                        retrievalQuery={"text": query},
                        retrievalConfiguration=retrieval_config,
                    )

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

    try:
        logger.info(f"Creating knowledge base query tool with {len(config)} KB(s)")
        return knowledge_base_query
    except Exception as e:
        logger.error(f"Failed to create knowledge base tool: {e}")
        return None


def _format_location(location: Dict[str, Any]) -> str:
    """Format location information for display"""
    loc_type = location.get("type", "")

    if loc_type == "S3":
        s3_location = location.get("s3Location", {})
        return f"{s3_location.get('uri', 'unknown')}"
    elif loc_type == "WEB":
        web_location = location.get("webLocation", {})
        return web_location.get("url", "unknown")
    elif loc_type == "CONFLUENCE":
        confluence_location = location.get("confluenceLocation", {})
        return confluence_location.get("url", "unknown")
    elif loc_type == "SALESFORCE":
        salesforce_location = location.get("salesforceLocation", {})
        return salesforce_location.get("url", "unknown")
    elif loc_type == "SHAREPOINT":
        sharepoint_location = location.get("sharePointLocation", {})
        return sharepoint_location.get("url", "unknown")

    return "unknown"
