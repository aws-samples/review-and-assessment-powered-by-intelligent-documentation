"""Tool execution history collector using Strands Hooks."""

from strands.experimental.hooks import AfterToolInvocationEvent
from strands.hooks import HookProvider, HookRegistry


class ToolHistoryCollector(HookProvider):
    """Collect tool execution history during agent run."""

    def __init__(self, truncate_length: int = 300):
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

        # Extract essentials for knowledge_base_query
        if event.tool_use["name"] == "knowledge_base_query":
            output_value = self._extract_kb_essentials(output_value)
        # Truncate other tools
        elif len(output_value) > self.truncate_length:
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

    def _extract_kb_essentials(self, output: str) -> str:
        """Extract essential fields from KB query output."""
        import json

        try:
            data = json.loads(output)
            results = data.get("results", [])
            
            compact_results = []
            for r in results:
                compact_results.append({
                    "text": r.get("text", "")[:500],
                    "location": r.get("location"),
                    "metadata": {
                        "page": r.get("metadata", {}).get("page")
                    } if r.get("metadata", {}).get("page") else {}
                })
            
            compact_data = {
                "query": data.get("query", ""),
                "results": compact_results
            }
            
            return json.dumps(compact_data, ensure_ascii=False)
        except:
            return output
