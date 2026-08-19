#!/usr/bin/env python3
"""
Tests for document/image prompt caching.

Covers three layers:
  - _apply_cache_config: the agent enables the auto cache strategy.
  - The message shape built by the document-block path: an explicit
    cachePoint sits BETWEEN the document blocks and the per-item prompt,
    so the cached prefix is identical across review items that share the
    same documents (cross-item cache reuse).
  - SDK contract: strands honors that manually placed cachePoint instead
    of moving it to the end of the message (behavior introduced in
    strands-agents 1.52.0; the pyproject floor is pinned accordingly).
"""

import os
import sys

# Add parent directory to path (same convention as the other suites).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import agent
from strands.models import BedrockModel
from strands.models.model import CacheConfig
from strands.types.content import Messages


def test_apply_cache_config_uses_auto_strategy():
    cfg = {"model_id": "global.anthropic.claude-sonnet-4-6"}
    agent._apply_cache_config(cfg)

    assert isinstance(cfg["cache_config"], CacheConfig)
    assert cfg["cache_config"].strategy == "auto"
    assert cfg["cache_tools"] == "default"
    assert "cache_prompt" not in cfg  # deprecated key no longer used


def test_supports_caching_gates_cache_config():
    """Unregistered models fall back to no caching (fail-safe)."""
    assert agent.supports_caching("global.anthropic.claude-sonnet-4-6") is True
    assert agent.supports_caching("some.unregistered.model-id") is False


def test_placed_cache_point_between_document_and_prompt_is_honored():
    """SDK contract for cross-item document caching.

    The document-block path builds `[document..., cachePoint, per-item text]`.
    strands >= 1.52.0 must honor that placed cachePoint where it sits
    (`_honor_placed_cache_point`), so the cached prefix ends at the documents
    and stays identical across review items. If the SDK moved the point to
    the end of the message, the per-item text would enter the prefix and
    cross-item reuse would silently break — this test is the canary for that.
    It intentionally exercises the private `_format_bedrock_messages` to pin
    the SDK behavior; revisit it whenever strands-agents is upgraded.
    """
    model = BedrockModel(
        model_id="global.anthropic.claude-sonnet-4-6",
        region_name="us-west-2",
        cache_config=CacheConfig(strategy="auto"),
    )

    # Same shape as _run_agent_with_document_block: docs, cachePoint, prompt.
    messages: Messages = [
        {
            "role": "user",
            "content": [
                {
                    "document": {
                        "name": "review_doc",
                        "format": "pdf",
                        "source": {"bytes": b"%PDF-1.4 fake pdf bytes"},
                    }
                },
                {"cachePoint": {"type": "default"}},
                {"text": "Evaluate this document against the check item."},
            ],
        }
    ]

    formatted = model._format_bedrock_messages(messages)

    content = formatted[0]["content"]
    cache_idxs = [i for i, b in enumerate(content) if "cachePoint" in b]
    doc_idxs = [i for i, b in enumerate(content) if "document" in b]
    text_idxs = [i for i, b in enumerate(content) if "text" in b]

    assert len(cache_idxs) == 1, "exactly one cachePoint must survive"
    assert doc_idxs and text_idxs, "document and text blocks must be preserved"
    # The property that makes cross-item reuse possible:
    # every document precedes the cachePoint, and the cachePoint precedes
    # the per-item prompt text.
    assert max(doc_idxs) < cache_idxs[0] < min(text_idxs)


def test_auto_strategy_appends_cache_point_when_none_placed():
    """Without a placed point (file_read/image path), auto appends one at the
    end of the last user message. The cached prefix then includes the per-item
    prompt, which only enables intra-item multi-turn reuse — kept as a
    regression pin so the difference between the two paths stays explicit."""
    model = BedrockModel(
        model_id="global.anthropic.claude-sonnet-4-6",
        region_name="us-west-2",
        cache_config=CacheConfig(strategy="auto"),
    )

    messages: Messages = [
        {
            "role": "user",
            "content": [{"text": "Per-item prompt text only."}],
        }
    ]

    formatted = model._format_bedrock_messages(messages)

    content = formatted[0]["content"]
    kinds = [next(iter(b.keys())) for b in content]
    assert kinds == ["text", "cachePoint"]
