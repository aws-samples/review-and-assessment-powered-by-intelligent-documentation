---
name: modify-agent-prompts
description: Modify the review-item-processor agent's prompts, model configuration, confidence thresholds, JSON output schemas, and tool setup. Use when changing document or image review prompts, adjusting model IDs, modifying output format, updating citation settings, or adding new tools to the agent.
---

# Modify Agent Prompts and Configuration

## Agent Architecture

```
review-item-processor/
├── agent.py               # Prompt generators + agent execution
├── model_config.py        # Model registry with capabilities
├── tools/
│   ├── factory.py         # Dynamic tool creation
│   ├── knowledge_base.py  # Bedrock KB integration
│   ├── code_interpreter.py
│   └── mcp_tool.py        # MCP tool support
└── index.py               # Lambda handler entry point
```

## Common Modifications

### 1. Modifying Document Review Prompts

**File**: `agent.py`

Key functions:
- `get_document_review_prompt()` - Main entry point
- `_get_document_review_prompt_with_citations()` - With citations
- `_get_document_review_prompt_legacy()` - Without citations

**JSON Schema**:
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

### 2. Modifying Image Review Prompts

**File**: `agent.py`, function `get_image_review_prompt()`

**JSON Schema** (Nova models add `boundingBoxes`):
```python
{
  "result": "pass" | "fail",
  "confidence": <number 0-1>,
  "explanation": "<detailed reasoning>",
  "shortExplanation": "<max 80 chars>",
  "usedImageIndexes": [<list of indexes>]
}
```

### 3. Model Configuration

**Environment Variables** (set in CDK):
- `DOCUMENT_PROCESSING_MODEL_ID`, `IMAGE_REVIEW_MODEL_ID`, `BEDROCK_REGION`
- `ENABLE_CITATIONS`, `ENABLE_CODE_INTERPRETER`

**Change models via CDK**:
```bash
cdk deploy -c rapid.documentProcessingModelId="global.anthropic.claude-opus-4-5-20251101-v1:0"
```

**Add new model** to `model_config.py` in `_get_model_configs()`:
```python
"model-id": ModelConfig(
    model_id="model-id",
    supports_document_block=True,
    supports_citation=True,
    supports_caching=True,
    input_per_1k=0.XXX,
    output_per_1k=0.XXX,
)
```

### 4. Adding New Environment Variables

1. Define in `cdk/lib/parameter-schema.ts`
2. Pass to Lambda in `cdk/lib/constructs/agent.ts`
3. Read in `agent.py` with `os.environ.get()`

### 5. Adding New Tools

For detailed tool creation guide, see [references/TOOL-CREATION.md](references/TOOL-CREATION.md).

## Quick Reference

| Modification | Location | Search For |
|--------------|----------|------------|
| Document prompt schema | agent.py | `_get_document_review_prompt` |
| Image prompt schema | agent.py | `get_image_review_prompt` |
| Confidence guidelines | agent.py | `confidence_guidelines` |
| Tool usage instructions | agent.py | `_build_tool_usage_section` |
| Model capabilities | model_config.py | `_get_model_configs` |
| Environment variables | CDK agent.ts | `environment:` |

## Troubleshooting

| Issue | Check |
|-------|-------|
| Citations not working | `ENABLE_CITATIONS` env var, model supports citations in `model_config.py` |
| Model not found | Model ID format, available in `BEDROCK_REGION`, added to `model_config.py` |
| Tool not available | Tool configuration in event payload, registered in `factory.py` |
| Wrong output format | JSON schema in prompt, `{language_name}` placeholders |

## After Modification

1. Run `/build-and-format` if Python code changed
2. Run `/deploy-cdk-stack` if CDK changes made
3. Test with sample documents and monitor CloudWatch logs
