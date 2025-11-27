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
        # Extract essentials for code_interpreter
        elif event.tool_use["name"] == "code_interpreter":
            output_value = self._extract_code_interpreter_essentials(output_value)
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
                location = r.get("location")
                compact_results.append({
                    "text": r.get("text", "")[:500],
                    "location": location,
                    "locationType": self._detect_location_type(location),
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

    def _detect_location_type(self, location: str) -> str:
        """
        Detect location type from formatted location string.
        
        Returns:
            "S3" - S3 URI (s3://bucket/key)
            "URL" - HTTP(S) URL (Web, Confluence, Salesforce, SharePoint)
            "OTHER" - Custom, Kendra, SQL or unknown
        """
        if not location:
            return "OTHER"
        
        if location.startswith("s3://"):
            return "S3"
        elif location.startswith("http://") or location.startswith("https://"):
            return "URL"
        else:
            return "OTHER"

    def _extract_code_interpreter_essentials(self, output: str) -> str:
        """Extract essential fields from code interpreter output."""
        import json

        try:
            data = json.loads(output)
            
            compact_data = {
                "stdout": data.get("stdout", ""),
                "stderr": data.get("stderr", ""),
                "exitCode": data.get("exitCode", 0)
            }
            
            return json.dumps(compact_data, ensure_ascii=False)
        except:
            return output
