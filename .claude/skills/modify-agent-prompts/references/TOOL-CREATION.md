# Agent Tool Creation Guide

Reference for adding new tools to the review-item-processor agent.

## Step 1: Create Tool Implementation

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
        result = perform_action(param1, param2)
        return result

    return AgentTool.from_function(
        tool_function,
        name="my_new_tool",
        description="What this tool does"
    )
```

## Step 2: Register Tool in Factory

Edit `tools/factory.py`:

```python
from tools.my_new_tool import create_my_new_tool

def create_custom_tools(tool_config: Dict[str, Any]) -> List[AgentTool]:
    tools = []
    if tool_config.get("myNewTool"):
        tools.append(create_my_new_tool(tool_config["myNewTool"]))
    return tools
```

## Step 3: Update Tool Configuration Schema

If tool needs configuration from database/event, update:
- Database schema (backend Prisma schema)
- API validation (backend routes)
- Frontend types and UI

## Step 4: Add Tool Usage Instructions to Prompts

Edit prompt generators in `agent.py`:

```python
# In _build_tool_usage_section() or directly in prompt
tool_instruction = """
## WHEN TO USE MY_NEW_TOOL
- WHEN you need to do X -> USE my_new_tool
- WHEN you need to verify Y -> USE my_new_tool
"""
```

## Tool Configuration Structure

```python
tool_configuration = {
    "knowledgeBase": [
        {
            "knowledgeBaseId": "KB123",
            "name": "Building Regulations",
            "dataSourceIds": ["DS456"]
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

## Available Tools

- `file_read` - Read document content
- `image_reader` - Read image content
- `knowledge_base_query` - Query Bedrock Knowledge Bases
- `code_interpreter` - Execute Python code
- **MCP tools** - Dynamic tools from MCP servers
- **Custom tools** - Your own tool implementations
