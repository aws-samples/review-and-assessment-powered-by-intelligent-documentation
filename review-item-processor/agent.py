import hashlib
import itertools
import json
import os
import re
import tempfile
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import boto3
from logger import logger
from model_config import ModelConfig
from strands import Agent
from strands.models import BedrockModel
from strands.tools.mcp import MCPClient
from strands.types.tools import AgentTool
from strands_tools import file_read, image_reader
from tool_history_collector import ToolHistoryCollector
from tools.factory import create_custom_tools


class ReviewMetaTracker:
    """Class to track review metadata such as pricing and execution time."""

    def __init__(self, model_id: str):
        self.model = ModelConfig.create(model_id)
        self.start_time = time.time()

    def get_review_meta(self, agent_result) -> Dict[str, Any]:
        """Extract review metadata from the agent result."""
        end_time = time.time()
        duration = end_time - self.start_time

        metrics = agent_result.metrics
        usage = metrics.accumulated_usage
        input_tokens = usage.get("inputTokens", 0)
        output_tokens = usage.get("outputTokens", 0)
        total_tokens = usage.get("totalTokens", 0)

        logger.debug(
            f"Token usage from metrics: input={input_tokens}, output={output_tokens}, total={total_tokens}"
        )

        input_cost = (input_tokens / 1000) * self.model.input_per_1k
        output_cost = (output_tokens / 1000) * self.model.output_per_1k
        total_cost = input_cost + output_cost

        return {
            "model_id": self.model.model_id,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "input_cost": input_cost,
            "output_cost": output_cost,
            "total_cost": total_cost,
            "pricing": {
                "input_per_1k": self.model.input_per_1k,
                "output_per_1k": self.model.output_per_1k,
            },
            "duration_seconds": round(duration, 2),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# File type constants
IMAGE_FILE_EXTENSIONS = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".tif",
    ".tiff",
    ".webp",
]
PDF_FILE_EXTENSIONS = [".pdf"]

# Default model IDs
DEFAULT_DOCUMENT_MODEL_ID = (
    "global.anthropic.claude-sonnet-4-20250514-v1:0"  # For all processing
)
DEFAULT_IMAGE_MODEL_ID = "global.anthropic.claude-sonnet-4-20250514-v1:0"  # For image processing (same as document by default)

# Get model IDs from environment variables with fallback to defaults
DOCUMENT_MODEL_ID = os.environ.get(
    "DOCUMENT_PROCESSING_MODEL_ID", DEFAULT_DOCUMENT_MODEL_ID
)
IMAGE_MODEL_ID = os.environ.get("IMAGE_REVIEW_MODEL_ID", DEFAULT_IMAGE_MODEL_ID)

# Log model configuration
if os.environ.get("DOCUMENT_PROCESSING_MODEL_ID"):
    logger.info(f"INFO: Using custom document processing model: {DOCUMENT_MODEL_ID}")
else:
    logger.info(f"INFO: Using default document processing model: {DOCUMENT_MODEL_ID}")

if os.environ.get("IMAGE_REVIEW_MODEL_ID"):
    logger.info(f"INFO: Using custom image review model: {IMAGE_MODEL_ID}")
else:
    logger.info(f"INFO: Using default image review model: {IMAGE_MODEL_ID}")

# Backward compatibility
SONNET_MODEL_ID = DOCUMENT_MODEL_ID
NOVA_PREMIER_MODEL_ID = IMAGE_MODEL_ID

# Get environment variables
AWS_REGION = os.environ.get("AWS_REGION", "us-west-2")
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-west-2")
ENABLE_CITATIONS = os.environ.get("ENABLE_CITATIONS", "true").lower() == "true"
# Tool text truncate length
TOOL_TEXT_TRUNCATE_LENGTH = 500


def supports_caching(model_id: str) -> bool:
    """
    Check if the given model supports prompt and tool caching.

    Args:
        model_id: Bedrock model ID to check

    Returns:
        True if the model supports caching, False otherwise
    """
    model = ModelConfig.create(model_id)
    return model.supports_caching


def _should_use_document_block(
    document_paths: list,
    model_id: str,
    has_images: bool
) -> bool:
    """
    Determine if document block should be used.
    
    Document block: Embed PDF directly in request
    File read tool: Use file_read tool with file paths
    
    Args:
        document_paths: List of document paths
        model_id: Bedrock model ID
        has_images: Whether documents contain images
        
    Returns:
        True to use document block, False to use file_read tool
    """
    if has_images:
        return False
    
    model = ModelConfig.create(model_id)
    return ENABLE_CITATIONS and model.supports_document_block


def create_mcp_client(mcp_server_cfg: Dict[str, Any]) -> MCPClient:
    """
    Create an MCP client for the given server configuration.

    Args:
        mcp_server_cfg: MCP server configuration

    Returns:
        MCPClient: Initialized MCP client
    """
    logger.info(f"Creating MCP client with config: {mcp_server_cfg}")
    # TODO
    # return MCPClient(...)
    raise NotImplementedError("MCP is handled directly by AgentCore Runtime")


def sanitize_file_name(filename: str) -> str:
    """
    Sanitize filename to meet Bedrock requirements.
    Bedrock only allows alphanumeric characters, whitespace, hyphens,
    parentheses, and square brackets in filenames.

    Args:
        filename: Original filename

    Returns:
        Sanitized filename
    """
    # Remove file extension if present
    parts = filename.split(".")
    name_without_extension = ".".join(parts[:-1]) if len(parts) > 1 else filename

    # Calculate hash of the original name
    file_hash = hashlib.md5(name_without_extension.encode()).hexdigest()[:8]

    # Create sanitized name
    sanitized = f"doc_{file_hash}"
    logger.debug(f"Sanitized filename: {sanitized} (original: {filename})")

    return sanitized


def list_tools_sync(client: MCPClient) -> List[Dict[str, Any]]:
    """
    List available tools from an MCP client.

    Args:
        client: MCP client

    Returns:
        List of tool definitions
    """
    logger.debug("Listing tools from MCP client")
    try:
        # Use the built-in list_tools_sync method directly
        tools = client.list_tools_sync()
        logger.debug(f"Found {len(tools)} tools from MCP client")
        return tools
    except Exception as e:
        logger.error(f"Error listing tools from MCP client: {e}")
        return []


# Agent execution functions
def _run_agent_with_file_read_tool(
    prompt: str,
    file_paths: List[str],
    model_id: str = DOCUMENT_MODEL_ID,
    system_prompt: str = "You are an expert document reviewer.",
    temperature: float = 0.0,
    base_tools: Optional[List[Any]] = None,
    toolConfiguration: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Run Strands agent with traditional file_read approach"""
    logger.debug(f"Running Strands agent with {len(file_paths)} files")
    logger.debug(f"Tool configuration: {toolConfiguration}")

    meta_tracker = ReviewMetaTracker(model_id)
    history_collector = ToolHistoryCollector(truncate_length=TOOL_TEXT_TRUNCATE_LENGTH)

    # Use provided base tools or default to file_read
    tools_to_use = base_tools if base_tools else [file_read]

    # Add custom tools based on configuration
    custom_tools = create_custom_tools(toolConfiguration)

    # Managed Integration: MCPClient passed directly to Agent
    # Agent handles lifecycle automatically
    tools = tools_to_use + custom_tools
    logger.debug(f"Total tools available: {len(tools)}")

    # Create Strands agent
    logger.debug(f"Creating Strands agent with model: {model_id}")

    # Check if model supports caching
    model = ModelConfig.create(model_id)
    model_supports_cache = model.supports_caching
    logger.debug(f"Model {model_id} caching support: {model_supports_cache}")

    # Configure BedrockModel with conditional caching
    bedrock_config = {
        "model_id": model_id,
        "region_name": BEDROCK_REGION,
        "temperature": temperature,
        "streaming": False,  # Always disable streaming since this app doesn't use streaming
    }

    if model_supports_cache:
        bedrock_config["cache_prompt"] = "default"  # Enable system prompt caching
        bedrock_config["cache_tools"] = "default"  # Enable tool definitions caching
        logger.debug("Caching enabled for system prompt and tools")
    else:
        logger.debug("Caching disabled - model does not support prompt caching")

    agent = Agent(
        model=BedrockModel(**bedrock_config),
        tools=tools,
        system_prompt=system_prompt,
        hooks=[history_collector],
    )

    # Add file references to the prompt
    files_prompt = "\n".join([f"- '{file_path}'" for file_path in file_paths])
    full_prompt = f"{prompt}\n\nPlease analyze the following files:\n{files_prompt}"

    logger.debug(f"Running agent with prompt: {full_prompt[:100]}...")
    logger.debug(f"Full prompt: {full_prompt}")

    # Run agent synchronously
    logger.debug("Executing agent completion")
    response = agent(full_prompt)
    logger.debug("Agent response received")

    result = _agent_message_to_dict_legacy(response.message, response)
    logger.debug("type(response.message)=%s", type(response.message))
    logger.debug("message.content (trunc)=%s", str(response.message)[:300])

    # Set tool usage history from hook
    result["verificationDetails"] = {"sourcesDetails": history_collector.executions}

    logger.debug("Extracting usage metrics from agent result")
    review_meta = meta_tracker.get_review_meta(response)
    result["reviewMeta"] = review_meta
    result["inputTokens"] = review_meta["input_tokens"]
    result["outputTokens"] = review_meta["output_tokens"]
    result["totalCost"] = review_meta["total_cost"]

    logger.info(
        f"Token usage: input={review_meta['input_tokens']}, output={review_meta['output_tokens']}, cost=${review_meta['total_cost']:.6f}"
    )
    logger.debug(f"Extracted result dict: {result}")
    return result


def _run_agent_with_document_block(
    prompt: str,
    file_paths: List[str],
    model_id: str = DOCUMENT_MODEL_ID,
    system_prompt: str = "You are an expert document reviewer.",
    temperature: float = 0.0,
    toolConfiguration: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Run Strands agent with document block.
    
    Document block embeds PDF directly in the request.
    Citations will be enabled only if model supports it.
    """
    
    model = ModelConfig.create(model_id)
    
    logger.debug(
        f"Running agent with document block: {len(file_paths)} files, "
        f"citations.enabled={model.supports_citation}, model={model_id}"
    )
    
    if not model.supports_citation:
        logger.info(
            f"Citations disabled for {model_id} "
            f"(model supports document block but not citations)"
        )
    
    meta_tracker = ReviewMetaTracker(model_id)
    history_collector = ToolHistoryCollector(truncate_length=TOOL_TEXT_TRUNCATE_LENGTH)
    
    custom_tools = create_custom_tools(toolConfiguration)
    
    # Prepare document blocks
    content = []
    for file_path in file_paths:
        try:
            with open(file_path, "rb") as f:
                file_bytes = f.read()
        except Exception as e:
            logger.error(f"Failed to read file {file_path}: {e}")
            continue
        
        filename = os.path.basename(file_path)
        sanitized_name = sanitize_file_name(filename)
        
        doc_block = {
            "document": {
                "name": sanitized_name,
                "source": {"bytes": file_bytes},
                "format": "pdf",
                "citations": {"enabled": model.supports_citation},
            }
        }
        
        content.append(doc_block)
    
    content.append({"text": prompt})
    
    # Configure model
    bedrock_config = {
        "model_id": model_id,
        "region_name": BEDROCK_REGION,
        "temperature": temperature,
        "streaming": False,
    }
    
    if model.supports_caching:
        bedrock_config["cache_prompt"] = "default"
        bedrock_config["cache_tools"] = "default"
    
    agent = Agent(
        model=BedrockModel(**bedrock_config),
        tools=custom_tools,
        system_prompt=system_prompt,
        hooks=[history_collector],
    )
    
    logger.debug("Executing agent with document block")
    response = agent(content)
    
    result = _agent_message_to_dict(
        response.message, 
        response, 
        use_citations=model.supports_citation
    )
    
    result["verificationDetails"] = {"sourcesDetails": history_collector.executions}
    review_meta = meta_tracker.get_review_meta(response)
    result["reviewMeta"] = review_meta
    result["inputTokens"] = review_meta["input_tokens"]
    result["outputTokens"] = review_meta["output_tokens"]
    result["totalCost"] = review_meta["total_cost"]
    
    return result


# Message parsing functions
def _extract_json_from_message(message: Any) -> Tuple[Optional[Dict[str, Any]], str]:
    """
    メッセージからJSONとテキストを抽出

    Args:
        message: AgentResult.message

    Returns:
        Tuple[Optional[Dict], str]: (抽出されたJSON dict, 全テキスト)
    """
    if isinstance(message, dict) and "content" in message:
        text_blocks = []
        for block in message["content"]:
            if isinstance(block, dict) and "text" in block:
                text_blocks.append(block["text"])

        combined = "".join(text_blocks).strip()
    else:
        combined = str(message).strip()

    # マーカー付きJSON抽出を試行
    json_match = re.search(r"<<JSON_START>>(.*?)<<JSON_END>>", combined, re.DOTALL)
    if json_match:
        json_str = json_match.group(1).strip()
        try:
            return json.loads(json_str), combined
        except Exception as e:
            logger.warning(f"Marker JSON parsing failed: {e}")

    # フォールバック: 通常のJSON抽出
    m = re.search(r"\{.*\}", combined, re.DOTALL)
    if m:
        json_str = m.group(0)
        try:
            return json.loads(json_str), combined
        except Exception as e:
            logger.warning(f"JSON parsing failed: {e}")

    return None, combined


def _extract_citations_text(message: Any) -> List[str]:
    """
    Extract citations from JSON response as array.

    Note: This method parses citations from the JSON output instead of using
    citationsContent blocks because Strands Agent does not properly support
    citationsContent in non-streaming mode. The model generates <cite> tags
    instead of proper citation blocks when using the Citations API.

    Workaround: We explicitly instruct the model to include citations as a
    JSON array field in the response, then parse and return them here.

    Args:
        message: AgentResult.message containing JSON response

    Returns:
        List[str]: Citations array, or empty list if none found
    """
    try:
        # Extract JSON from message
        parsed_json, _ = _extract_json_from_message(message)

        if parsed_json and "citations" in parsed_json:
            citations = parsed_json["citations"]
            if citations and isinstance(citations, list):
                return citations
    except Exception as e:
        logger.warning(f"Failed to extract citations from JSON: {e}")

    # Return empty list if no citations found
    return []


def _agent_message_to_dict(
    message: Any, agent_response=None, use_citations: bool = False
) -> Dict[str, Any]:
    """
    AgentResult.messageを結果dictに変換（統合版）

    Args:
        message: AgentResult.message
        agent_response: AgentResult（未使用、後方互換性のため保持）
        use_citations: Citation機能を使用するか

    Returns:
        Dict: 審査結果
    """
    # JSON抽出
    parsed_json, combined_text = _extract_json_from_message(message)

    # JSONが抽出できた場合
    if parsed_json:
        result = parsed_json

        # Citation処理
        if use_citations:
            result["extractedText"] = _extract_citations_text(message)

        return result

    # フォールバック
    fallback = {
        "result": "fail",
        "confidence": 0.5,
        "explanation": combined_text,
        "shortExplanation": "Failed to analyze JSON parse",
    }

    if use_citations:
        fallback["extractedText"] = _extract_citations_text(message)

    return fallback


def _agent_message_to_dict_legacy(message: Any, agent_response=None) -> Dict[str, Any]:
    """Convert AgentResult.message (dict or list) to a result dict."""
    return _agent_message_to_dict(message, agent_response, use_citations=False)


def _agent_message_to_dict_with_citations(
    message: Any, agent_response=None
) -> Dict[str, Any]:
    """Convert AgentResult.message to result dict with citation support"""
    return _agent_message_to_dict(message, agent_response, use_citations=True)


# Helper function for dynamic tool section generation
def _build_tool_usage_section(
    tool_config: Optional[Dict[str, Any]],
    language_name: str,
) -> str:
    """Build tool usage section dynamically based on configuration"""
    if not tool_config:
        return ""

    tool_descriptions = []
    use_cases = []

    # Code Interpreter
    if tool_config.get("codeInterpreter", False):
        tool_descriptions.append(
            "- **code_interpreter**: Perform calculations, data analysis, or process structured data"
        )
        use_cases.append("- Perform calculations or data analysis → Use code_interpreter")

    # Knowledge Base
    kb_config = tool_config.get("knowledgeBase")
    if kb_config:
        tool_descriptions.append(
            "- **knowledge_base_query**: Search knowledge bases for regulations, standards, or reference information"
        )
        use_cases.append(
            "- Verify compliance with regulations/standards → Use knowledge_base_query"
        )

    # MCP (future)
    mcp_config = tool_config.get("mcpConfig")
    if mcp_config:
        tool_descriptions.append(
            "- **MCP tools**: Additional specialized tools configured for this review"
        )
        use_cases.append("- Access external data sources → Use MCP tools")

    if not tool_descriptions:
        return ""

    tools_list = "\n".join(tool_descriptions)
    use_cases_list = "\n".join(use_cases)

    return f"""
<tool_usage>
<default_to_action>
Use available tools proactively to verify information:

{tools_list}

When to use tools:
{use_cases_list}
- Confidence below 0.80 → Use tools to increase confidence
</default_to_action>

<use_parallel_tool_calls>
When calling multiple independent tools, execute them in parallel. Only call tools sequentially when later calls depend on earlier results.
</use_parallel_tool_calls>
</tool_usage>
"""


# Prompt generation functions
def _get_document_review_prompt_legacy(
    language_name: str,
    check_name: str,
    check_description: str,
    tool_config: Optional[Dict[str, Any]] = None,
) -> str:
    """Improved PDF document review prompt with dynamic tool section"""

    json_schema = f"""{{
  "result": "pass" | "fail",
  "confidence": <number between 0 and 1>,
  "explanation": "<detailed reasoning in {language_name}>",
  "shortExplanation": "<max 80 chars in {language_name}>",
  "extractedText": "<relevant excerpt in {language_name}>",
  "pageNumber": <integer starting from 1>
}}"""

    tool_section = _build_tool_usage_section(tool_config, language_name)

    return f"""You are an expert document reviewer. Review the attached documents against this check item:

<check_item>
**Name**: {check_name}
**Description**: {check_description}
</check_item>

<document_access>
Use the file_read tool to open and inspect each attached file.
</document_access>
{tool_section}
<output_requirements>
Generate your entire response in {language_name}. Output only the JSON below, enclosed in markers:

<<JSON_START>>
{json_schema}
<<JSON_END>>

**CRITICAL RULES:**
1. **Base your judgment ONLY on the provided documents and information obtained through tools** - Do NOT use your pre-trained general knowledge or make assumptions
2. **If the required information is not found in the documents or through tool usage:**
   - Set "result": "fail"
   - Set "confidence": 0.40 (or lower if extremely uncertain)
   - In "explanation", clearly state in {language_name} that the required information was not found and describe what specific information is missing
   - In "shortExplanation", write the phrase for "insufficient evidence" in {language_name}
   - Set "extractedText": "" (empty string)

Confidence guidelines:
- 0.90-1.00: Clear evidence found in documents, obvious compliance/non-compliance
- 0.70-0.89: Relevant evidence found in documents with some uncertainty
- 0.50-0.69: Ambiguous evidence found in documents, significant uncertainty
- 0.30-0.49: Insufficient evidence in documents to make a determination

Your response must be valid JSON within the markers. All field values must be in {language_name}.
</output_requirements>
""".strip()


def _get_document_review_prompt_with_citations(
    language_name: str,
    check_name: str,
    check_description: str,
    tool_config: Optional[Dict[str, Any]] = None,
) -> str:
    """PDF document review prompt with citations in JSON array"""

    json_schema = f"""{{
  "result": "pass" | "fail",
  "confidence": <number between 0 and 1>,
  "explanation": "<detailed reasoning in {language_name}>",
  "shortExplanation": "<max 80 chars in {language_name}>",
  "pageNumber": <integer starting from 1>,
  "citations": ["<quoted text 1>", "<quoted text 2>", ...]
}}"""

    tool_section = _build_tool_usage_section(tool_config, language_name)

    return f"""You are an expert document reviewer. Review the attached documents against this check item:

<check_item>
**Name**: {check_name}
**Description**: {check_description}
</check_item>

<document_access>
Documents are provided with citation support enabled. When you reference specific information from the documents, write your explanation in natural prose.
</document_access>

<citation_instruction>
When you reference specific content from the documents, include the exact quoted text in the "citations" array.
Each citation should be a direct quote from the source document that supports your explanation.

Example:
"citations": [
  "The building height shall not exceed 15 meters as specified in Section 3.2",
  "Fire safety equipment must be installed on every floor per Regulation 4.1"
]
</citation_instruction>
{tool_section}
<output_requirements>
Generate your entire response in {language_name}. Output only the JSON below, enclosed in markers:

<<JSON_START>>
{json_schema}
<<JSON_END>>

Write the explanation field as clear, flowing prose in {language_name}. Include relevant quotes in the citations array.

**CRITICAL RULES:**
1. **Base your judgment ONLY on the provided documents and information obtained through tools** - Do NOT use your pre-trained general knowledge or make assumptions
2. **If the required information is not found in the documents or through tool usage:**
   - Set "result": "fail"
   - Set "confidence": 0.40 (or lower if extremely uncertain)
   - In "explanation", clearly state in {language_name} that the required information was not found and describe what specific information is missing
   - In "shortExplanation", write the phrase for "insufficient evidence" in {language_name}
   - Set "citations": [] (empty array)

Confidence guidelines:
- 0.90-1.00: Clear evidence found in documents, obvious compliance/non-compliance
- 0.70-0.89: Relevant evidence found in documents with some uncertainty
- 0.50-0.69: Ambiguous evidence found in documents, significant uncertainty
- 0.30-0.49: Insufficient evidence in documents to make a determination

Your response must be valid JSON within the markers. All field values must be in {language_name}.
</output_requirements>
""".strip()


# Legacy compatibility
def get_document_review_prompt(
    language_name: str,
    check_name: str,
    check_description: str,
    use_citations: bool = False,
    tool_config: Optional[Dict[str, Any]] = None,
) -> str:
    """PDF document review prompt with optional citation support"""
    if use_citations:
        return _get_document_review_prompt_with_citations(
            language_name, check_name, check_description, tool_config
        )
    else:
        return _get_document_review_prompt_legacy(
            language_name, check_name, check_description, tool_config
        )


def get_image_review_prompt(
    language_name: str,
    check_name: str,
    check_description: str,
    model_id: str,
    tool_config: Optional[Dict[str, Any]] = None,
) -> str:
    """Improved image review prompt with dynamic tool section"""
    is_nova = "amazon.nova" in model_id

    bbox_field = (
        f""",
  "boundingBoxes": [
      {{
        "imageIndex": <image index>,
        "label": "<label in {language_name}>",
        "coordinates": [<x1>, <y1>, <x2>, <y2>]
      }}
  ]"""
        if is_nova
        else ""
    )

    bbox_instruction = (
        "\n\nFor detected objects, provide bounding box coordinates in [x1, y1, x2, y2] format (0-1000 scale)."
        if is_nova
        else ""
    )

    json_schema = f"""{{
  "result": "pass" | "fail",
  "confidence": <number between 0 and 1>,
  "explanation": "<detailed reasoning in {language_name}>",
  "shortExplanation": "<max 80 chars in {language_name}>",
  "usedImageIndexes": [<indexes of images actually referenced>]{bbox_field}
}}"""

    tool_section = _build_tool_usage_section(tool_config, language_name)

    return f"""
You are an AI assistant who reviews images.
(Model ID: {model_id})
Please review the provided image(s) based on the following check item.

Check item: {check_name}
Description: {check_description}

## DOCUMENT ACCESS
The actual files are attached. Use the *image_reader* tool to analyze them.

## WHEN & HOW TO USE EXTERNAL TOOLS
You have access to additional tools including MCP tools and knowledge_base_query.
Follow these guidelines:

- WHEN you need to verify factual information in the image (addresses,
  company names, figures, dates, etc.)  
  → **USE** a search/scrape-type MCP tool to confirm with external sources.
- WHEN you need to verify compliance against regulations, standards, or internal policies stored in knowledge bases  
  → **USE** knowledge_base_query to search authoritative knowledge bases.
- WHEN the image content is unclear, ambiguous, or requires additional context  
  → **USE** MCP tools to gather supplementary evidence.
- WHEN precise definitions of visual elements or regulations are required  
  → **USE** an MCP tool to consult official or authoritative references.
- WHEN confirming the existence or legitimacy of an organisation/person shown
  in the image  
  → **USE** an MCP tool that can access public registries or databases.
- WHEN your estimated confidence would fall below **0.80**  
  → **USE** one or more external tools to raise your confidence.

## IMPORTANT OUTPUT LANGUAGE REQUIREMENT
YOU MUST GENERATE THE ENTIRE OUTPUT IN {language_name}.  
ALL TEXT — including every JSON value — MUST BE IN {language_name}.

Review the content and determine compliance. If multiple images are provided,
address them by zero-based index (0th, 1st, …).{bbox_instruction}

**Populate `usedImageIndexes` only with the indexes of images you explicitly
referenced when making your judgment; do NOT include unused images.**

**Do NOT mention, summarise, or list images that contained no information
relevant to the check item.** If you relied on just one image, the array must
contain exactly that single index; an empty array means “none used”.


**CRITICAL RULES:**
1. **Base your judgment ONLY on the provided images and information obtained through tools** - Do NOT use your pre-trained general knowledge or make assumptions
2. **If the required visual information is not found in the images or through tool usage:**
   - Set "result": "fail"
   - Set "confidence": 0.40 (or lower if extremely uncertain)
   - In "explanation", clearly state in {language_name} that the required visual information was not found and describe what specific visual elements are missing
   - In "shortExplanation", write the phrase for "insufficient evidence" in {language_name}
   - Set "usedImageIndexes": [] (empty array)
Respond **only** in the following JSON format (no Markdown code fences):

{{
  "result": "pass" | "fail",
  "confidence": <number between 0 and 1>,
  "explanation": "<detailed reasoning> (IN {language_name})",
  "shortExplanation": "<≤80 characters summary> (IN {language_name})",
  "usedImageIndexes": [<indexes actually referenced>]{bbox_field}
}}

REMEMBER: YOUR ENTIRE RESPONSE, INCLUDING EVERY VALUE INSIDE THE JSON,
MUST BE IN {language_name}.
""".strip()


# Main processing functions
def process_review(
    document_bucket: str,
    document_paths: list,
    check_name: str,
    check_description: str,
    language_name: str = "日本語",
    model_id: str = DOCUMENT_MODEL_ID,
    toolConfiguration: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Process a document review using Strands agent with local file reading.
    Main dispatcher that chooses between citation and legacy processing.
    """
    logger.debug(f"Processing review for check: {check_name}")
    logger.debug(f"Tool configuration: {toolConfiguration}")

    # Create temporary directory for downloaded files
    temp_dir = tempfile.mkdtemp()
    logger.debug(f"Created temporary directory: {temp_dir}")
    local_file_paths = []

    # Track file types
    has_images = False

    try:
        # Download files from S3
        logger.debug(f"Downloading {len(document_paths)} files from S3")
        s3_client = boto3.client("s3")

        # Dictionary to map sanitized file paths to original file paths
        sanitized_file_paths = []

        for path in document_paths:
            # Get original basename
            original_basename = os.path.basename(path)

            # Create sanitized filename
            sanitized_basename = sanitize_file_name(original_basename)
            if original_basename != sanitized_basename:
                logger.debug(
                    f"Sanitized filename '{original_basename}' to '{sanitized_basename}'"
                )

            # Download to sanitized path
            ext = os.path.splitext(original_basename)[
                1
            ].lower()  # Preserve file extension
            sanitized_path = os.path.join(temp_dir, sanitized_basename + ext)
            logger.debug(f"Downloading {path} to {sanitized_path}")

            s3_client.download_file(document_bucket, path, sanitized_path)
            sanitized_file_paths.append(sanitized_path)
            logger.debug(f"Downloaded {path} to {sanitized_path}")

            # Check if this is an image file
            if ext in IMAGE_FILE_EXTENSIONS:
                has_images = True
                logger.debug(f"Detected image file: {original_basename}")

        # Use sanitized file paths for agent
        local_file_paths = sanitized_file_paths

        # Select appropriate model based on file types
        # Use provided model_id, or fallback to defaults
        if model_id:
            selected_model_id = model_id
        else:
            selected_model_id = IMAGE_MODEL_ID if has_images else DOCUMENT_MODEL_ID
        
        if has_images:
            logger.debug(f"Using image processing model: {selected_model_id}")
        else:
            logger.debug(f"Using document processing model: {selected_model_id}")

        # Processing method decision
        use_document_block = _should_use_document_block(
            document_paths, selected_model_id, has_images
        )
        logger.debug(
            f"Processing method: "
            f"{'document_block' if use_document_block else 'file_read_tool'}, "
            f"model={selected_model_id}"
        )

        # Dispatch to appropriate processing method
        if use_document_block:
            # Document block path
            prompt = get_document_review_prompt(
                language_name, check_name, check_description, 
                use_citations=False,  # Will be determined by model
                tool_config=toolConfiguration
            )
            
            system_prompt = f"You are an expert document reviewer. Analyze the provided files and evaluate the check item. All responses must be in {language_name}."
            
            result = _run_agent_with_document_block(
                prompt=prompt,
                file_paths=local_file_paths,
                model_id=selected_model_id,
                system_prompt=system_prompt,
                toolConfiguration=toolConfiguration,
            )
            result["reviewType"] = "PDF"
            logger.debug("Used document block processing")
            
        else:
            # File read tool path
            if has_images:
                prompt = get_image_review_prompt(
                    language_name, check_name, check_description, 
                    selected_model_id, toolConfiguration
                )
                tools = [file_read, image_reader]
                review_type = "IMAGE"
            else:
                prompt = get_document_review_prompt(
                    language_name, check_name, check_description,
                    use_citations=False,
                    tool_config=toolConfiguration
                )
                tools = [file_read]
                review_type = "PDF"
            
            system_prompt = f"You are an expert document reviewer. Analyze the provided files and evaluate the check item. All responses must be in {language_name}."
            
            result = _run_agent_with_file_read_tool(
                prompt=prompt,
                file_paths=local_file_paths,
                model_id=selected_model_id,
                system_prompt=system_prompt,
                base_tools=tools,
                toolConfiguration=toolConfiguration,
            )
            result["reviewType"] = review_type
            logger.debug("Used file_read tool processing")

        # Ensure all required fields exist
        logger.debug("Validating result fields")
        if "result" not in result:
            logger.debug("Adding missing 'result' field")
            result["result"] = "fail"
        if "confidence" not in result:
            logger.debug("Adding missing 'confidence' field")
            result["confidence"] = 0.5
        if "explanation" not in result:
            logger.debug("Adding missing 'explanation' field")
            result["explanation"] = "No explanation provided"
        if "shortExplanation" not in result:
            logger.debug("Adding missing 'shortExplanation' field")
            result["shortExplanation"] = "No short explanation provided"
        if "verificationDetails" not in result:
            logger.debug("Adding missing 'verificationDetails' field")
            result["verificationDetails"] = {"sourcesDetails": []}
        elif "sourcesDetails" not in result["verificationDetails"]:
            logger.debug("Adding missing 'sourcesDetails' field")
            result["verificationDetails"]["sourcesDetails"] = []

        # Add file type specific fields if missing
        if has_images:
            if "usedImageIndexes" not in result:
                logger.debug("Adding missing 'usedImageIndexes' field")
                result["usedImageIndexes"] = []
            if "boundingBoxes" not in result:
                logger.debug("Adding missing 'boundingBoxes' field")
                result["boundingBoxes"] = []
        else:
            if "extractedText" not in result:
                logger.debug("Adding missing 'extractedText' field")
                result["extractedText"] = ""
            if "pageNumber" not in result:
                logger.debug("Adding missing 'pageNumber' field")
                result["pageNumber"] = 1

        logger.info(
            f"Document review completed successfully with reviewType: {result['reviewType']}"
        )
        return result

    finally:
        # Clean up temporary files
        logger.debug("Cleaning up temporary files")
        for file_path in local_file_paths:
            if os.path.exists(file_path):
                logger.debug(f"Removing temporary file: {file_path}")
                os.remove(file_path)
        if os.path.exists(temp_dir):
            logger.debug(f"Removing temporary directory: {temp_dir}")
            os.rmdir(temp_dir)
        logger.debug("Cleanup complete")
