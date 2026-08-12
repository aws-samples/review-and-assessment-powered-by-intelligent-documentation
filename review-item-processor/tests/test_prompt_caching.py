#!/usr/bin/env python3
"""
Tests for document/image prompt caching (auto cache strategy).
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


def test_bedrock_auto_strategy_caches_after_document_block():
    """SDK contract: cache_config=auto puts the cachePoint AFTER a document, so
    the document ends up inside the cached prefix."""
    model = BedrockModel(
        model_id="global.anthropic.claude-sonnet-4-6",
        cache_config=CacheConfig(strategy="auto"),
    )

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
                {"text": "Evaluate this document against the check item."},
            ],
        }
    ]

    formatted = model._format_bedrock_messages(messages)

    content = formatted[0]["content"]
    cache_idxs = [i for i, b in enumerate(content) if "cachePoint" in b]
    doc_idxs = [i for i, b in enumerate(content) if "document" in b]

    assert cache_idxs, "auto strategy must inject a cachePoint"
    assert doc_idxs, "document block should be preserved"
    assert max(doc_idxs) < max(cache_idxs)  # doc must precede the cache point
