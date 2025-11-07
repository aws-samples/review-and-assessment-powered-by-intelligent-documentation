"""Tool execution history collector using Strands Hooks."""

from strands.hooks import HookProvider, HookRegistry
from strands.experimental.hooks import AfterToolInvocationEvent


class ToolHistoryCollector(HookProvider):
    """Collect tool execution history during agent run."""

    def __init__(self, truncate_length: int = 100):
        """
        Initialize the collector.

        Args:
            truncate_length: Maximum length for output text truncation
        """
        self.executions = []
        self.truncate_length = truncate_length

    def register_hooks(self, registry: HookRegistry, **kwargs) -> None:
        """Register hook callbacks."""
        registry.add_callback(AfterToolInvocationEvent, self.after_tool_execution)

    def after_tool_execution(self, event: AfterToolInvocationEvent) -> None:
        """
        Called after each tool execution.

        Args:
            event: Tool invocation event containing tool_use and result
        """
        import json

        output_value = ""

        if event.result.get("content"):
            for c in event.result["content"]:
                # Prefer json content over text
                if "json" in c:
                    output_value = json.dumps(c["json"], ensure_ascii=False)
                    break
                elif "text" in c:
                    output_value = c["text"]

        # Truncate if exceeds limit
        if len(output_value) > self.truncate_length:
            output_value = "<!TRUNCATED>" + output_value[: self.truncate_length]

        self.executions.append(
            {
                "toolUseId": event.tool_use["toolUseId"],
                "toolName": event.tool_use["name"],
                "input": event.tool_use.get("input", {}),
                "output": output_value,
                "status": event.result.get("status", "unknown"),
            }
        )
