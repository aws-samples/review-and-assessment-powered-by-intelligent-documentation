import hashlib
import itertools
import json
import logging
import os
import re
import tempfile
import time
from contextlib import ExitStack
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import boto3
from lambda_function_client import LambdaFunctionParameters, lambda_function_client
from strands import Agent
from strands.models import BedrockModel
from strands.tools.mcp import MCPClient
from strands_tools import file_read, image_reader

logger = logging.getLogger(__name__)
# Set logging level
logger.setLevel(logging.DEBUG)


class ReviewMetaTracker:
    """Class to track review metadata such as pricing and execution time."""

    def __init__(self, model_id: str):
        self.model_id = model_id
        self.pricing = self._get_model_pricing(model_id)
        self.start_time = time.time()

    def _get_model_pricing(self, model_id: str) -> Dict[str, float]:
        """Get pricing information for the specified model ID."""
        pricing_table = {
            "us.anthropic.claude-3-7-sonnet-20250219-v1:0": {
                "input_per_1k": 0.003,
                "output_per_1k": 0.015,
            },
            "us.amazon.nova-premier-v1:0": {
                "input_per_1k": 0.0025,
                "output_per_1k": 0.0125,
            },
        }
        return pricing_table.get(model_id, {"input_per_1k": 0, "output_per_1k": 0})

    def get_review_meta(self, agent_result) -> Dict[str, Any]:
        """Extract review metadata from the agent result."""
        end_time = time.time()
        duration = end_time - self.start_time

        metrics = agent_result.metrics
        usage = metrics.accumulated_usage
        input_tokens = usage.get("inputTokens", 0)
        output_tokens = usage.get("outputTokens", 0)
        total_tokens = usage.get("totalTokens", 0)

        logging.debug(
            f"Token usage from metrics: input={input_tokens}, output={output_tokens}, total={total_tokens}"
        )

        input_cost = (input_tokens / 1000) * self.pricing["input_per_1k"]
        output_cost = (output_tokens / 1000) * self.pricing["output_per_1k"]
        total_cost = input_cost + output_cost

        return {
            "model_id": self.model_id,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "input_cost": input_cost,
            "output_cost": output_cost,
            "total_cost": total_cost,
            "pricing": self.pricing,
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
    "us.anthropic.claude-3-7-sonnet-20250219-v1:0"  # For all processing
)
DEFAULT_IMAGE_MODEL_ID = "us.anthropic.claude-3-7-sonnet-20250219-v1:0"  # For image processing (same as document by default)

# Get model IDs from environment variables with fallback to defaults
DOCUMENT_MODEL_ID = os.environ.get(
    "DOCUMENT_PROCESSING_MODEL_ID", DEFAULT_DOCUMENT_MODEL_ID
)
IMAGE_MODEL_ID = os.environ.get("IMAGE_REVIEW_MODEL_ID", DEFAULT_IMAGE_MODEL_ID)

# Log model configuration
if os.environ.get("DOCUMENT_PROCESSING_MODEL_ID"):
    print(f"INFO: Using custom document processing model: {DOCUMENT_MODEL_ID}")
else:
    print(f"INFO: Using default document processing model: {DOCUMENT_MODEL_ID}")

if os.environ.get("IMAGE_REVIEW_MODEL_ID"):
    print(f"INFO: Using custom image review model: {IMAGE_MODEL_ID}")
else:
    print(f"INFO: Using default image review model: {IMAGE_MODEL_ID}")

# Backward compatibility
SONNET_MODEL_ID = DOCUMENT_MODEL_ID
NOVA_PREMIER_MODEL_ID = IMAGE_MODEL_ID

# Get environment variables
PY_MCP_LAMBDA_ARN = os.environ.get("PY_MCP_LAMBDA_ARN", "")
NODE_MCP_LAMBDA_ARN = os.environ.get("NODE_MCP_LAMBDA_ARN", "")
AWS_REGION = os.environ.get("AWS_REGION", "us-west-2")
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-west-2")
# Models that support prompt and tool caching
# Base model IDs that support prompt and tool caching (without region prefixes)
CACHE_SUPPORTED_BASE_MODELS = {
    # Anthropic Claude models
    "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "anthropic.claude-3-5-sonnet-20240620-v1:0",
    "anthropic.claude-3-5-haiku-20241022-v1:0",
    "anthropic.claude-3-opus-20240229-v1:0",
    "anthropic.claude-3-sonnet-20240229-v1:0",
    "anthropic.claude-3-haiku-20240307-v1:0",
    "anthropic.claude-sonnet-4-20250514-v1:0",
    "anthropic.claude-opus-4-20250514-v1:0",
    "anthropic.claude-3-7-sonnet-20250219-v1:0",
    # # Amazon Nova models
    # "amazon.nova-premier-v1:0",
    # "amazon.nova-pro-v1:0",
    # "amazon.nova-lite-v1:0",
    # "amazon.nova-micro-v1:0",
}


def supports_caching(model_id: str) -> bool:
    """
    Check if the given model supports prompt and tool caching.

    Handles both direct model IDs and cross-region inference profiles
    (e.g., us.anthropic.claude-3-5-sonnet-20241022-v2:0, eu.amazon.nova-premier-v1:0).

    Args:
        model_id: Bedrock model ID to check

    Returns:
        True if the model supports caching, False otherwise
    """
    # First check if it's a direct model ID
    if model_id in CACHE_SUPPORTED_BASE_MODELS:
        return True

    # Check if it's a cross-region inference profile
    # Pattern: {region}.{model_id} where region is lowercase letters
    import re

    cross_region_pattern = re.compile(r"^[a-z]+\.")
    match = cross_region_pattern.match(model_id)
    if match:
        # Extract the base model ID by removing the region prefix
        prefix_end = match.end()
        base_model_id = model_id[prefix_end:]
        return base_model_id in CACHE_SUPPORTED_BASE_MODELS

    # Model not supported
    return False


def create_mcp_client(mcp_server_cfg: Dict[str, Any]) -> MCPClient:
    """
    Create an MCP client for the given server configuration.

    Args:
        mcp_server_cfg: MCP server configuration

    Returns:
        MCPClient: Initialized MCP client
    """
    logger.debug(f"Creating MCP client with config: {mcp_server_cfg}")
    cmd = mcp_server_cfg.get("command")

    if cmd == "uvx":
        fn_arn = PY_MCP_LAMBDA_ARN
        logger.debug(f"Using Python MCP Lambda ARN: {fn_arn}")
    elif cmd == "npx":
        fn_arn = NODE_MCP_LAMBDA_ARN
        logger.debug(f"Using Node MCP Lambda ARN: {fn_arn}")
    else:
        raise ValueError(f"Unsupported command: {cmd}")

    return MCPClient(
        lambda: lambda_function_client(
            LambdaFunctionParameters(
                function_name=fn_arn, region_name=AWS_REGION, mcp_server=mcp_server_cfg
            )
        )
    )


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


def run_strands_agent(
    prompt: str,
    file_paths: List[str],
    model_id: str = DOCUMENT_MODEL_ID,
    system_prompt: str = "You are an expert document reviewer.",
    temperature: float = 0.0,
    base_tools: Optional[List[Any]] = None,
    mcpServers: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Run the Strands agent with the given prompt and file paths.

    Args:
        prompt: Prompt for the agent
        file_paths: List of local file paths to process
        model_id: Bedrock model ID to use
        system_prompt: System prompt for the agent
        temperature: Temperature setting for the model
        base_tools: Base tools to include (file_read, image_reader, etc.)
        mcpServers: List of MCP server configurations to use

    Returns:
        Agent response
    """
    logger.info(f"Running Strands agent with {len(file_paths)} files")
    logger.debug(f"File paths: {file_paths}")
    logger.debug(f"Using model: {model_id}, system prompt: {system_prompt}")

    meta_tracker = ReviewMetaTracker(model_id)

    # MCP servers configuration
    mcp_servers = []

    logger.debug(f"mcpServers input: {type(mcpServers)}, value: {mcpServers}")

    if mcpServers and isinstance(mcpServers, list) and len(mcpServers) > 0:
        logger.info(f"Using {len(mcpServers)} MCP server(s)")
        mcp_servers = mcpServers
    else:
        logger.info("No MCP servers specified or empty array, running without MCP tools")
        mcp_servers = []

    logger.debug(f"Final MCP servers configuration: {mcp_servers}")

    with ExitStack() as stack:
        # Create MCP clients
        logger.info("Creating MCP clients")
        clients = [stack.enter_context(create_mcp_client(cfg)) for cfg in mcp_servers]

        logger.info("Gathering tools from all MCP clients")

        mcp_tools = list(
            itertools.chain.from_iterable(client.list_tools_sync() for client in clients)
        )

        logger.debug(f"Found total of {len(mcp_tools)} MCP tools")
        for t in mcp_tools:
            tool_name = (
                getattr(t, "tool_name", None)
                or (t.get("name") if isinstance(t, dict) else None)
                or getattr(t, "name", repr(t))
            )
            logger.debug("* MCP tool: %s", tool_name)

        # Use provided base tools or default to file_read
        tools_to_use = base_tools if base_tools else [file_read]
        # Combine with MCP tools
        tools = tools_to_use + mcp_tools
        logger.info(f"Total tools available: {len(tools)}")

        # Create Strands agent
        logger.info(f"Creating Strands agent with model: {model_id}")

        # Check if model supports caching
        model_supports_cache = supports_caching(model_id)
        logger.info(f"Model {model_id} caching support: {model_supports_cache}")

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
            logger.info("Caching enabled for system prompt and tools")
        else:
            logger.info("Caching disabled - model does not support prompt caching")

        agent = Agent(
            model=BedrockModel(**bedrock_config),
            tools=tools,
            system_prompt=system_prompt,
        )

        # Add file references to the prompt
        files_prompt = "\n".join([f"- '{file_path}'" for file_path in file_paths])
        full_prompt = f"{prompt}\n\nPlease analyze the following files:\n{files_prompt}"

        logger.info(f"Running agent with prompt: {full_prompt[:100]}...")
        logger.debug(f"Full prompt: {full_prompt}")

        # Run agent synchronously
        logger.info("Executing agent completion")
        response = agent(full_prompt)
        logger.debug("Agent response received")

        result = agent_message_to_dict(response.message)
        logger.debug("type(response.message)=%s", type(response.message))
        logger.debug("message.content (trunc)=%s", str(response.message)[:300])

        logger.info("Extracting usage metrics from agent result")
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


def agent_message_to_dict(message: Any) -> Dict[str, Any]:
    """
    Convert AgentResult.message (dict or list) to a result dict.
    """
    if isinstance(message, dict) and "content" in message:
        texts = [
            block.get("text", "")
            for block in message["content"]
            if isinstance(block, dict) and "text" in block
        ]
        combined = "".join(texts).strip()
    else:
        combined = str(message).strip()

    logger.debug("combined text (first 400) = %s", combined[:400])

    # 文字列中の { … } を最初に貪欲に拾う
    m = re.search(r"\{.*\}", combined, re.DOTALL)
    if m:
        json_str = m.group(0)
        try:
            return json.loads(json_str)
        except Exception as e:
            logger.warning("json.loads failed: %s", e)

    fallback = {
        "result": "fail",
        "confidence": 0.5,
        "explanation": combined,
        "shortExplanation": "Failed to analyze JSON parse",
    }
    return fallback


def get_document_review_prompt(
    language_name: str, check_name: str, check_description: str
) -> str:
    """
    Get the PDF document review prompt template.

    Args:
        language_name: Language name to use in the prompt
        check_name: Name of the check item
        check_description: Description of the check item

    Returns:
        Formatted prompt template
    """
    return f"""
You are an AI assistant that reviews documents.
Please review the provided documents based on the following check item.

Check item: {check_name}
Description: {check_description}

## DOCUMENT ACCESS
The actual files are attached. Use the provided *file_read* tool to open and inspect each file.

## WHEN & HOW TO USE MCP TOOLS
You have access to additional MCP tools.   
Follow these guidelines:

- WHEN you need to verify factual information in the document (addresses, company names, figures, dates, etc.)  
  → **USE** a search/scrape-type MCP tool to confirm with external sources.
- WHEN the document content is incomplete, ambiguous, or contradictory  
  → **USE** MCP tools to gather supplementary evidence.
- WHEN precise definitions of technical terms or regulations are required  
  → **USE** an MCP tool to consult official or authoritative references.
- WHEN confirming the existence or legitimacy of an organisation/person  
  → **USE** an MCP tool that can access public registries or databases.
- WHEN the topic involves events or regulations updated within the last 2 years  
  → **USE** an MCP tool to obtain the latest information.
- WHEN your estimated confidence would fall below **0.80**  
  → **USE** one or more MCP tools to raise your confidence.

## IMPORTANT OUTPUT LANGUAGE REQUIREMENT
YOU MUST GENERATE THE ENTIRE OUTPUT IN {language_name}.  
THIS IS A STRICT REQUIREMENT. **ALL TEXT, INCLUDING EVERY JSON FIELD VALUE, MUST BE IN {language_name}.**

Determine whether the document complies with the check item and respond **only** in the following JSON format.  
Do **not** output anything outside the JSON. Do **not** use markdown code fences such as ```json.

{{
  "result": "pass" | "fail",
  "confidence": <number between 0 and 1>,
  "explanation": "<detailed reasoning> (IN {language_name})",
  "shortExplanation": "<≤80 characters summary> (IN {language_name})",
  "extractedText": "<relevant excerpt> (IN {language_name})",
  "pageNumber": <integer starting from 1>,
  "verificationDetails": {{
    "sourcesDetails": [
      {{
        "description": "<brief description of external source> (IN {language_name})",
        "mcpName": "<name of MCP tool used>"
      }}
    ]
  }}
}}

### Confidence‐score examples
- **High** (0.90 – 1.00): clear evidence, obvious compliance/non-compliance  
- **Medium** (0.70 – 0.89): relevant evidence but some uncertainty  
- **Low** (0.50 – 0.69): ambiguous evidence, significant uncertainty  

### Example responses  
*(illustrative only — your real output must be in {language_name})*

**High-confidence pass**
{{
  "result": "pass",
  "confidence": 0.95,
  "explanation": "The contractor's name, address, and contact information are clearly stated in Article 3.",
  "shortExplanation": "Pass: contractor info present in Article 3",
  "extractedText": "Article 3 (Contractor Information)…",
  "pageNumber": 2,
  "verificationDetails": {{ "sourcesDetails": [] }}
}}

**Medium-confidence fail with MCP verification**
{{
  "result": "fail",
  "confidence": 0.80,
  "explanation": "Property area is not mentioned; firecrawl_search confirmed no area information exists.",
  "shortExplanation": "Fail: property area missing",
  "extractedText": "Property location: …",
  "pageNumber": 1,
  "verificationDetails": {{
    "sourcesDetails": [
      {{
        "description": "firecrawl_search returned no area info for the given address.",
        "mcpName": "firecrawl_search"
      }}
    ]
  }}
}}

REMEMBER: YOUR ENTIRE RESPONSE, INCLUDING EVERY VALUE INSIDE THE JSON, MUST BE IN {language_name}.
""".strip()


def get_image_review_prompt(
    language_name: str,
    check_name: str,
    check_description: str,
    model_id: str,
) -> str:
    """
    Build an image-review prompt that automatically switches:

    * If `model_id` contains "amazon.nova" → include bounding-box instructions
      and the "boundingBoxes" field in the JSON schema.
    * Otherwise (e.g. Sonnet) → omit all bounding-box requirements.

    The prompt also requires `usedImageIndexes` to list **only** images actually
    referenced when making the judgment.
    """
    is_nova = "amazon.nova" in model_id

    bbox_note = (
        """
If objects related to the check item exist in the image, provide the bounding-
box coordinates in [x1, y1, x2, y2] format (0–1000 scale).
"""
        if is_nova
        else ""
    )

    bbox_field = (
        f"""
  ,"boundingBoxes": [
      {{
        "imageIndex": <image index>,
        "label": "<label of detected object> (IN {language_name})",
        "coordinates": [<x1>, <y1>, <x2>, <y2>]
      }}
  ]"""
        if is_nova
        else ""
    )

    return f"""
You are an AI assistant who reviews images.
(Model ID: {model_id})
Please review the provided image(s) based on the following check item.

Check item: {check_name}
Description: {check_description}

## DOCUMENT ACCESS
The actual files are attached. Use the *image_reader* tool to analyze them.

## WHEN & HOW TO USE MCP TOOLS
You have access to additional MCP tools. Follow these guidelines:

- WHEN you need to verify factual information in the image (addresses,
  company names, figures, dates, etc.)  
  → **USE** a search/scrape-type MCP tool to confirm with external sources.
- WHEN the image content is unclear, ambiguous, or requires additional context  
  → **USE** MCP tools to gather supplementary evidence.
- WHEN precise definitions of visual elements or regulations are required  
  → **USE** an MCP tool to consult official or authoritative references.
- WHEN confirming the existence or legitimacy of an organisation/person shown
  in the image  
  → **USE** an MCP tool that can access public registries or databases.
- WHEN your estimated confidence would fall below **0.80**  
  → **USE** one or more MCP tools to raise your confidence.

## IMPORTANT OUTPUT LANGUAGE REQUIREMENT
YOU MUST GENERATE THE ENTIRE OUTPUT IN {language_name}.  
ALL TEXT — including every JSON value — MUST BE IN {language_name}.

Review the content and determine compliance. If multiple images are provided,
address them by zero-based index (0th, 1st, …).{bbox_note}

**Populate `usedImageIndexes` only with the indexes of images you explicitly
referenced when making your judgment; do NOT include unused images.**

**Do NOT mention, summarise, or list images that contained no information
relevant to the check item.** If you relied on just one image, the array must
contain exactly that single index; an empty array means “none used”.

Respond **only** in the following JSON format (no Markdown code fences):

{{
  "result": "pass" | "fail",
  "confidence": <number between 0 and 1>,
  "explanation": "<detailed reasoning> (IN {language_name})",
  "shortExplanation": "<≤80 characters summary> (IN {language_name})",
  "usedImageIndexes": [<indexes actually referenced>]{bbox_field},
  "verificationDetails": {{
    "sourcesDetails": [
      {{
        "description": "<brief description of external source> (IN {language_name})",
        "mcpName": "<name of MCP tool used>"
      }}
    ]
  }}
}}

REMEMBER: YOUR ENTIRE RESPONSE, INCLUDING EVERY VALUE INSIDE THE JSON,
MUST BE IN {language_name}.
""".strip()


def process_review(
    document_bucket: str,
    document_paths: list,
    check_name: str,
    check_description: str,
    language_name: str = "日本語",
    model_id: str = DOCUMENT_MODEL_ID,
    mcpServers: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Process a document review using Strands agent with local file reading.

    Args:
        document_bucket: S3 bucket containing the documents
        document_paths: List of S3 keys to the documents
        check_name: Name of the check item
        check_description: Description of the check item
        language_name: Language to use for the review
        model_id: Bedrock model ID to use
        mcp_servers: MCP servers configuration to use

    Returns:
        Review results
    """
    logger.info(f"Processing review for check: {check_name}")
    logger.info(f"Documents: {len(document_paths)} files from bucket {document_bucket}")
    logger.debug(f"Document paths: {document_paths}")
    logger.debug(f"Using default model: {model_id}, language: {language_name}")

    # Create temporary directory for downloaded files
    temp_dir = tempfile.mkdtemp()
    logger.debug(f"Created temporary directory: {temp_dir}")
    local_file_paths = []

    # Track file types
    has_images = False

    try:
        # Download files from S3
        logger.info(f"Downloading {len(document_paths)} files from S3")
        s3_client = boto3.client("s3")

        # Dictionary to map sanitized file paths to original file paths
        sanitized_file_paths = []

        for path in document_paths:
            # Get original basename
            original_basename = os.path.basename(path)

            # Create sanitized filename
            sanitized_basename = sanitize_file_name(original_basename)
            if original_basename != sanitized_basename:
                logger.info(
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
            logger.info(f"Downloaded {path} to {sanitized_path}")

            # Check if this is an image file
            if ext in IMAGE_FILE_EXTENSIONS:
                has_images = True
                logger.info(f"Detected image file: {original_basename}")

        # Use sanitized file paths for agent
        local_file_paths = sanitized_file_paths

        # Select appropriate model and prompt based on file types
        selected_model_id = model_id
        if has_images:
            # Use image-specific model
            selected_model_id = IMAGE_MODEL_ID
            logger.info(f"Using image processing model: {selected_model_id}")
            prompt = get_image_review_prompt(
                language_name, check_name, check_description, selected_model_id
            )
            logger.info("Using image review prompt template")
        else:
            # Use document processing model for non-image files
            selected_model_id = DOCUMENT_MODEL_ID
            prompt = get_document_review_prompt(
                language_name, check_name, check_description
            )
            logger.info("Using document review prompt template")

        # Select tools based on file types
        tools = [file_read]
        if has_images:
            tools.append(image_reader)
            logger.info("Added image_reader tool for image processing")

        # Define system prompt
        system_prompt = f"You are an expert document reviewer. Analyze the provided files and evaluate the check item. All responses must be in {language_name}."

        # Run agent with flattened parameters
        logger.info("Running Strands agent for document review")
        result = run_strands_agent(
            prompt=prompt,
            file_paths=local_file_paths,
            model_id=selected_model_id,
            system_prompt=system_prompt,
            base_tools=tools,
            mcpServers=mcpServers,
        )
        logger.info(f"Agent completed with result: {result['result']}")

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

        # Add file type specific fields and explicit reviewType
        if has_images:
            # Add image-specific fields if missing
            result["reviewType"] = "IMAGE"
            if "usedImageIndexes" not in result:
                logger.debug("Adding missing 'usedImageIndexes' field")
                result["usedImageIndexes"] = []
            if "boundingBoxes" not in result:
                logger.debug("Adding missing 'boundingBoxes' field")
                result["boundingBoxes"] = []
        else:
            # Add PDF-specific fields if missing
            result["reviewType"] = "PDF"
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
        logger.info("Cleaning up temporary files")
        for file_path in local_file_paths:
            if os.path.exists(file_path):
                logger.debug(f"Removing temporary file: {file_path}")
                os.remove(file_path)
        if os.path.exists(temp_dir):
            logger.debug(f"Removing temporary directory: {temp_dir}")
            os.rmdir(temp_dir)
        logger.info("Cleanup complete")
