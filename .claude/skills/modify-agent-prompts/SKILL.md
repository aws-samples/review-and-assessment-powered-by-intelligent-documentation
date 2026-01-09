---
name: modify-agent-prompts
description: Modify review-item-processor agent prompts, models, and tool configuration
---

# Modify Agent Prompts and Configuration

This skill guides you through modifying the review-item-processor agent's prompts, model configuration, and tool setup.

## When to Use

- Changing document or image review prompts
- Adjusting model IDs (Claude, Nova models)
- Modifying confidence thresholds or guidelines
- Changing JSON schema output format
- Adding new tools to the agent
- Updating tool configurations (MCP, Knowledge Base, Code Interpreter)
- Adding/removing agent capabilities
- Modifying citation support or tool usage instructions

## When NOT to Use

- **Modifying Step Functions workflows** → use `/modify-cdk-workflows`
- **Backend API or database changes** → use `/plan-backend-frontend`
- **Simple builds or formatting** → use `/build-and-format`
- **Deploying to AWS** → use `/deploy-cdk-stack`

## Agent Architecture Overview

```
review-item-processor/
├── agent.py                    # Main agent implementation
│   ├── Prompt generators       # get_document_review_prompt(), get_image_review_prompt()
│   ├── Agent execution         # process_review()
│   └── Tool configuration      # Tool setup
├── model_config.py             # Model registry with capabilities
├── tools/
│   ├── factory.py              # Dynamic tool creation
│   ├── knowledge_base.py       # Bedrock KB integration
│   ├── code_interpreter.py     # AgentCore Code Interpreter
│   └── mcp_tool.py             # MCP tool support
└── index.py                    # Lambda handler entry point
```

## Common Modification Patterns

### 1. Modifying Document Review Prompts

**Files**: `review-item-processor/agent.py`

**Key Functions to Find**:
- `get_document_review_prompt()` - Main entry point
- `_get_document_review_prompt_with_citations()` - With citations
- `_get_document_review_prompt_legacy()` - Without citations

**JSON Schema Structure**:
```python
{
  "result": "pass" | "fail",
  "confidence": <number 0-1>,
  "explanation": "<detailed reasoning>",
  "shortExplanation": "<max 80 chars>",
  "pageNumber": <integer from 1>,
  "citations": ["<quoted text>", ...]
}
```

**Common Changes**:
- Add new fields to JSON schema
- Modify confidence guidelines section
- Update citation instructions
- Change insufficient information handling
- Adjust tool usage instructions in prompt

### 2. Modifying Image Review Prompts

**Files**: `review-item-processor/agent.py`

**Key Function**: `get_image_review_prompt()`

**JSON Schema Structure**:
```python
{
  "result": "pass" | "fail",
  "confidence": <number 0-1>,
  "explanation": "<detailed reasoning>",
  "shortExplanation": "<max 80 chars>",
  "usedImageIndexes": [<list of indexes>],
  "boundingBoxes": [...]  # Nova models only
}
```

**Model-Specific Features**:
- **Nova models**: Bounding box support with coordinates
- **Claude models**: Standard image analysis

### 3. Model Configuration

**Environment Variables** (set in CDK, read in agent.py):
```python
DOCUMENT_PROCESSING_MODEL_ID  # Model for PDF processing
IMAGE_REVIEW_MODEL_ID          # Model for image processing
BEDROCK_REGION                 # Which AWS region for Bedrock
ENABLE_CITATIONS               # Enable/disable citations
ENABLE_CODE_INTERPRETER        # Enable/disable code interpreter
```

**Model Capabilities** (defined in `model_config.py`):
- `supports_document_block` - Can embed PDFs directly
- `supports_citation` - Can generate citations
- `supports_caching` - Prompt/tool caching support
- Pricing information (input/output per 1k tokens)

**How to Change Models**:

1. **Via CDK Parameters** (recommended):
```bash
cdk deploy -c rapid.documentProcessingModelId="global.anthropic.claude-opus-4-5-20251101-v1:0"
```

2. **Add New Model** to `model_config.py`:
```python
# In _get_model_configs(), add entry:
"model-id-here": ModelConfig(
    model_id="model-id-here",
    supports_document_block=True/False,
    supports_citation=True/False,
    supports_caching=True/False,
    input_per_1k=0.XXX,
    output_per_1k=0.XXX,
)
```

### 4. Adding New Tools

**Step 1: Create Tool Implementation**

Create new file in `review-item-processor/tools/`:

```python
# tools/my_new_tool.py
from strands.types.tools import AgentTool

def create_my_new_tool(config: dict) -> AgentTool:
    """Create custom tool with configuration"""

    def tool_function(param1: str, param2: int) -> str:
        """
        Tool description shown to the agent.

        Args:
            param1: Description of parameter 1
            param2: Description of parameter 2

        Returns:
            Result description
        """
        # Tool implementation here
        result = perform_action(param1, param2)
        return result

    return AgentTool.from_function(
        tool_function,
        name="my_new_tool",
        description="What this tool does"
    )
```

**Step 2: Register Tool in Factory**

Edit `tools/factory.py`:

```python
from tools.my_new_tool import create_my_new_tool

def create_custom_tools(tool_config: Dict[str, Any]) -> List[AgentTool]:
    """Create tools based on configuration"""
    tools = []

    # Add to tool creation logic
    if tool_config.get("myNewTool"):
        tools.append(create_my_new_tool(tool_config["myNewTool"]))

    return tools
```

**Step 3: Update Tool Configuration Schema**

If tool needs configuration from database/event, update:
- Database schema (backend Prisma schema)
- API validation (backend routes)
- Frontend types and UI

**Step 4: Add Tool Usage Instructions to Prompts**

Edit prompt generators in `agent.py`:

```python
# In _build_tool_usage_section() or directly in prompt
tool_instruction = """
## WHEN TO USE MY_NEW_TOOL
- WHEN you need to do X → USE my_new_tool
- WHEN you need to verify Y → USE my_new_tool
"""
```

### 5. Tool Configuration

**Tool Enablement** (from event/database):
```python
tool_configuration = {
    "knowledgeBase": [
        {
            "knowledgeBaseId": "KB123",
            "name": "Building Regulations",
            "dataSourceIds": ["DS456"]  # Optional
        }
    ],
    "codeInterpreter": True,
    "mcpConfig": {
        "servers": {
            "web-search": {
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-web-search"]
            }
        }
    }
}
```

**Available Tools**:
- `file_read` - Read document content
- `image_reader` - Read image content
- `knowledge_base_query` - Query Bedrock Knowledge Bases
- `code_interpreter` - Execute Python code
- **MCP tools** - Dynamic tools from MCP servers
- **Custom tools** - Your own tool implementations

### 6. Environment Variables

**Key Variables** (set in CDK):
```typescript
// cdk/lib/constructs/agent.ts
environment: {
  DOCUMENT_PROCESSING_MODEL_ID: props.documentProcessingModelId,
  IMAGE_REVIEW_MODEL_ID: props.imageReviewModelId,
  BEDROCK_REGION: props.bedrockRegion,
  ENABLE_CITATIONS: props.enableCitations.toString(),
  ENABLE_CODE_INTERPRETER: props.enableCodeInterpreter.toString(),
}
```

**To Add New Variable**:
1. Add to `cdk/lib/parameter-schema.ts` (parameter definition)
2. Add to `cdk/lib/constructs/agent.ts` (pass to Lambda)
3. Read in `review-item-processor/agent.py` with `os.environ.get()`

## Quick Reference

| Modification | Location | Search For |
|--------------|----------|------------|
| Document prompt schema | agent.py | `_get_document_review_prompt` |
| Image prompt schema | agent.py | `get_image_review_prompt` |
| Confidence guidelines | agent.py | Search "confidence_guidelines" |
| Tool usage instructions | agent.py | `_build_tool_usage_section` |
| Model IDs | agent.py | `DOCUMENT_MODEL_ID` |
| Model capabilities | model_config.py | `_get_model_configs` |
| Environment variables | CDK agent.ts | `environment:` |
| Add new tool | tools/ | Create new file + update factory.py |

## Troubleshooting

### Citations Not Working
- Check `ENABLE_CITATIONS` environment variable
- Verify model supports citations in `model_config.py`
- Ensure using PDFs (not images)
- Model must support `supports_document_block`

### Model Not Found
- Verify model ID is correct format
- Check model available in BEDROCK_REGION
- Add model to `model_config.py` if new
- Use inference profile: `global.anthropic.claude-*`

### Tool Not Available
- Check tool configuration in event payload
- Verify tool is registered in `factory.py`
- Check MCP server configuration
- Review tool enablement flags

### Wrong Output Format
- Review JSON schema in prompt
- Check all fields use `{language_name}` placeholders
- Verify prompt emphasizes JSON output requirement

## Verification Steps

1. **Test Agent Locally** (if possible)
   - Use sample documents/images
   - Verify JSON output matches schema

2. **Check Environment Variables**
   - AWS Console → Lambda → Configuration
   - Verify all variables set correctly

3. **Review Agent Execution**
   - Check CloudWatch Logs
   - Verify model selection
   - Check tool execution
   - Monitor token usage

4. **Test New Tools**
   - Verify tool appears in agent's available tools
   - Check tool is called when appropriate
   - Validate tool output format

## Success Criteria

- [ ] Prompts generate expected JSON schema
- [ ] Model IDs configured correctly
- [ ] New tools accessible and functional
- [ ] Environment variables set
- [ ] Citations work (if enabled)
- [ ] Confidence scores reasonable
- [ ] Language requirements met
- [ ] No errors in CloudWatch logs

## After Modification

1. Run `/build-and-format` if Python code changed
2. Run `/deploy-cdk-stack` if CDK changes made
3. Test with sample documents
4. Monitor CloudWatch logs for first executions
