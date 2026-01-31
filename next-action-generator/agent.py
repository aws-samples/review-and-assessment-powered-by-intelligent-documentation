"""
Next Action Generator Agent

This module uses Strands Agent to generate actionable next steps
based on review results with optional tool support.
"""
import os
import time
from typing import Any, Dict, List, Optional

from strands import Agent
from strands.models import BedrockModel

from logger import logger
from model_config import ModelConfig
from template_expander import expand_template_variables
from tool_history_collector import ToolHistoryCollector
from tools.factory import create_custom_tools

# Configuration
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-west-2")
DEFAULT_MODEL_ID = os.environ.get(
    "NEXT_ACTION_MODEL_ID", "global.anthropic.claude-sonnet-4-20250514-v1:0"
)
TEMPERATURE = 0.7  # Slightly creative for generating recommendations

# System prompt for next action generation
SYSTEM_PROMPT = """You are an AI assistant that generates actionable next steps based on document review results.

Your task is to analyze the review results and generate clear, specific, and prioritized recommendations for document corrections and improvements.

Guidelines:
- Be specific about WHICH file or section needs modification
- Provide concrete examples of WHAT content should be added or changed
- Reference the extracted text and explanations from failed items
- Output in the same language as the input document
- Prioritize items based on importance and impact"""


def process_next_action(
    prompt_template: Dict[str, Any],
    template_data: Dict[str, Any],
    tool_configuration: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Process next action generation using Strands Agent.

    Args:
        prompt_template: Template with prompt content
        template_data: Data to expand in the template
        tool_configuration: Optional tool configuration for agent

    Returns:
        Dictionary containing status, nextAction, and metrics
    """
    start_time = time.time()

    # Get model configuration
    model_config = ModelConfig.create(DEFAULT_MODEL_ID)
    model_id = model_config.model_id

    logger.info(f"[NextActionAgent] Using model: {model_id}")

    # Expand template variables
    prompt_content = prompt_template.get("prompt", "")
    expanded_prompt = expand_template_variables(prompt_content, template_data)

    logger.info(f"[NextActionAgent] Expanded prompt length: {len(expanded_prompt)}")

    # Create tools if configuration provided
    tools: List[Any] = []
    history_collector = ToolHistoryCollector(truncate_length=500)

    if tool_configuration:
        logger.info(f"[NextActionAgent] Creating tools from configuration")
        tools = create_custom_tools(tool_configuration)
        logger.info(f"[NextActionAgent] Created {len(tools)} tools")

    # Build BedrockModel configuration
    bedrock_config = {
        "model_id": model_id,
        "region_name": BEDROCK_REGION,
        "temperature": TEMPERATURE,
        "streaming": False,
    }

    # Add caching if supported
    if model_config.supports_caching:
        bedrock_config["cache_prompt"] = "default"
        bedrock_config["cache_tools"] = "default"
        logger.info("[NextActionAgent] Prompt caching enabled")

    # Create and run agent
    try:
        agent = Agent(
            model=BedrockModel(**bedrock_config),
            tools=tools,
            system_prompt=SYSTEM_PROMPT,
            hooks=[history_collector],
        )

        logger.info("[NextActionAgent] Running agent...")
        response = agent(expanded_prompt)

        # Extract metrics
        metrics = response.metrics
        usage = metrics.accumulated_usage if metrics else {}
        input_tokens = usage.get("inputTokens", 0)
        output_tokens = usage.get("outputTokens", 0)
        total_tokens = usage.get("totalTokens", 0)

        # Calculate cost
        total_cost = model_config.calculate_cost(input_tokens, output_tokens)

        duration_ms = int((time.time() - start_time) * 1000)

        result = {
            "status": "success",
            "nextAction": str(response.message),
            "metrics": {
                "inputTokens": input_tokens,
                "outputTokens": output_tokens,
                "totalTokens": total_tokens,
                "totalCost": total_cost,
                "durationMs": duration_ms,
                "modelId": model_id,
            },
        }

        # Add tool execution history if any
        if history_collector.executions:
            result["toolExecutions"] = history_collector.executions

        logger.info(
            f"[NextActionAgent] Generation complete. "
            f"Tokens: {input_tokens}/{output_tokens}, "
            f"Cost: ${total_cost:.4f}, "
            f"Duration: {duration_ms}ms"
        )

        return result

    except Exception as e:
        logger.error(f"[NextActionAgent] Error during generation: {str(e)}")
        raise
