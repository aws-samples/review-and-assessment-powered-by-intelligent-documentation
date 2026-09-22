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


def _formatted_content(content):
    model = BedrockModel(
        model_id="global.anthropic.claude-sonnet-4-6",
        cache_config=CacheConfig(strategy="auto"),
    )
    messages: Messages = [{"role": "user", "content": content}]
    return model._format_bedrock_messages(messages)[0]["content"]


def _kinds(content):
    return [next(iter(block)) for block in content]


DOCUMENT = {
    "document": {
        "name": "review_doc",
        "format": "pdf",
        "source": {"bytes": b"%PDF-1.4 fake pdf bytes"},
    }
}
PROMPT = {"text": "Evaluate this document against the check item."}


def test_auto_strategy_alone_caches_the_per_item_prompt_too():
    """Why the caller places the cache point itself.

    Left to itself, the auto strategy appends the cache point to the end of the
    message, so the prompt that changes for every check item is inside the
    cached prefix. Every call then writes a new entry and none is read.
    """
    assert _kinds(_formatted_content([DOCUMENT, PROMPT])) == [
        "document",
        "text",
        "cachePoint",
    ]


def test_a_cache_point_placed_after_the_documents_is_kept_there():
    """SDK contract this fix relies on: a caller-placed cache point stays where
    it is, so only the documents are cached and the per-item prompt is not."""
    content = _formatted_content(
        [DOCUMENT, {"cachePoint": {"type": "default"}}, PROMPT]
    )
    assert _kinds(content) == ["document", "cachePoint", "text"]


def _captured_request(monkeypatch, tmp_path, model_id):
    """Run _run_agent_with_document_block with a fake agent and return what
    would have been sent to Bedrock."""
    pdf = tmp_path / "doc.pdf"
    pdf.write_bytes(b"%PDF-1.4 fake pdf bytes")
    sent = {}

    class FakeResponse:
        message = {"content": [{"text": '<<JSON_START>>{"result": "pass"}<<JSON_END>>'}]}

        class metrics:
            accumulated_usage = {"inputTokens": 0, "outputTokens": 0}

    class FakeAgent:
        def __init__(self, **kwargs):
            pass

        def __call__(self, content):
            sent["content"] = content
            return FakeResponse()

    monkeypatch.setattr(agent, "Agent", FakeAgent)
    agent._run_agent_with_document_block(
        prompt="Evaluate this document against the check item.",
        file_paths=[str(pdf)],
        model_id=model_id,
    )
    return sent["content"]


def test_documents_are_cached_without_the_per_item_prompt(monkeypatch, tmp_path):
    content = _captured_request(
        monkeypatch, tmp_path, "global.anthropic.claude-sonnet-4-6"
    )
    assert _kinds(content) == ["document", "cachePoint", "text"]


def test_no_cache_point_for_a_model_without_caching(monkeypatch, tmp_path):
    content = _captured_request(monkeypatch, tmp_path, "some.unregistered.model-id")
    assert "cachePoint" not in _kinds(content)
