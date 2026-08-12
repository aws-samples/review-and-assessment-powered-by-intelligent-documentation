#!/usr/bin/env python3
"""Citation tests for agent.py.

Offline tests cover _should_use_document_block (routing) and
_extract_citations_text (parsing). An opt-in Bedrock integration test runs only
with RUN_BEDROCK_INTEGRATION=1 (needs AWS credentials).
"""
import os
import sys
from pathlib import Path

import pytest

# Add parent directory to path so `import agent` works when run from any cwd.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import agent
from agent import _extract_citations_text, _should_use_document_block
from model_config import ModelConfig

# A registered model that supports the document block + citations.
CITATION_MODEL_ID = "global.anthropic.claude-sonnet-4-6"
# An unregistered model falls back to _DEFAULT_CONFIG (no document block).
UNKNOWN_MODEL_ID = "example.unknown-model-v1"


# ---------------------------------------------------------------------------
# _should_use_document_block: citation routing
# ---------------------------------------------------------------------------


def test_document_block_used_for_pdf_when_citations_enabled(monkeypatch):
    """PDF + citations enabled + capable model -> document block path."""
    monkeypatch.setattr(agent, "ENABLE_CITATIONS", True)
    assert (
        _should_use_document_block(["/tmp/a.pdf"], CITATION_MODEL_ID, has_images=False)
        is True
    )


def test_file_read_used_when_citations_disabled(monkeypatch):
    """ENABLE_CITATIONS=false falls back to the file_read tool path."""
    monkeypatch.setattr(agent, "ENABLE_CITATIONS", False)
    assert (
        _should_use_document_block(["/tmp/a.pdf"], CITATION_MODEL_ID, has_images=False)
        is False
    )


def test_file_read_used_for_images(monkeypatch):
    """Images always use the file_read/image_reader path, regardless of the flag."""
    monkeypatch.setattr(agent, "ENABLE_CITATIONS", True)
    assert (
        _should_use_document_block(["/tmp/a.png"], CITATION_MODEL_ID, has_images=True)
        is False
    )


def test_file_read_used_for_unknown_model(monkeypatch):
    """Unknown models fall back to defaults without document block support."""
    monkeypatch.setattr(agent, "ENABLE_CITATIONS", True)
    assert (
        _should_use_document_block(["/tmp/a.pdf"], UNKNOWN_MODEL_ID, has_images=False)
        is False
    )


def test_default_model_supports_citation():
    """The default model supports the document block and citations."""
    config = ModelConfig.create(CITATION_MODEL_ID)
    assert config.supports_document_block is True
    assert config.supports_citation is True


# ---------------------------------------------------------------------------
# _extract_citations_text: citations parsing from the JSON response
# ---------------------------------------------------------------------------


def _message_with_text(text: str) -> dict:
    """Build an AgentResult.message-shaped dict with a single text block."""
    return {"content": [{"text": text}]}


def test_extract_citations_returns_array():
    """A citations array in the marker JSON is returned as-is."""
    message = _message_with_text(
        '<<JSON_START>>{"result": "pass",'
        ' "citations": ["p.3 保管スペース", "p.5 避難経路"]}<<JSON_END>>'
    )
    assert _extract_citations_text(message) == ["p.3 保管スペース", "p.5 避難経路"]


def test_extract_citations_empty_when_absent():
    """JSON without a citations field yields an empty list."""
    message = _message_with_text('<<JSON_START>>{"result": "pass"}<<JSON_END>>')
    assert _extract_citations_text(message) == []


def test_extract_citations_empty_on_non_json():
    """Non-JSON output yields an empty list instead of raising."""
    assert _extract_citations_text(_message_with_text("no json here")) == []


# ---------------------------------------------------------------------------
# Opt-in Bedrock integration test (real API call, requires AWS credentials)
# ---------------------------------------------------------------------------


@pytest.mark.skipif(
    os.environ.get("RUN_BEDROCK_INTEGRATION") != "1",
    reason="Set RUN_BEDROCK_INTEGRATION=1 to run the live Bedrock integration test",
)
def test_citation_review_integration():
    """Run a real review over the bundled sample PDF via the citations path."""
    test_pdf = Path(__file__).parent / "office_planning.pdf"
    assert test_pdf.exists(), f"Test file not found: {test_pdf}"

    from agent import process_review_from_local

    result = process_review_from_local(
        document_paths=[str(test_pdf)],
        check_name="保管スペース確保",
        check_description="指定エリア内に整理保管され、避難経路を塞いでいない",
        language_name="日本語",
    )

    assert result.get("result") in ["pass", "fail"]
    assert 0 <= result.get("confidence", 0) <= 1
    assert result.get("explanation", "") != ""
    assert result.get("reviewType") == "PDF"


if __name__ == "__main__":
    os.environ["RUN_BEDROCK_INTEGRATION"] = "1"
    test_citation_review_integration()
    print("Integration test passed")
