#!/usr/bin/env python3
"""
Tests for files that share a name within one review job.

The backend stores each upload under its own document id
(review/original/{documentId}/{filename}), so two different files may have
the same name. The processor must keep them apart when it downloads them,
and give each a distinct Bedrock document name.
"""

import os
import sys

import pytest

# Add parent directory to path (same convention as the other suites).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import agent

MODEL_ID = "global.anthropic.claude-sonnet-4-6"


class FakeS3:
    """Writes each object's key as its content, so files can be told apart."""

    def download_file(self, bucket, key, local_path):
        with open(local_path, "w") as f:
            f.write(key)


class Sent(Exception):
    """Stops the agent once the request content has been captured."""


def _review_from_s3(monkeypatch, document_paths):
    seen = {}

    def fake_core(file_paths, **kwargs):
        # Read now: process_review_from_s3 removes the files once this returns.
        seen["paths"] = list(file_paths)
        seen["contents"] = [open(p).read() for p in file_paths]
        return {}

    monkeypatch.setattr(agent.boto3, "client", lambda service: FakeS3())
    monkeypatch.setattr(agent, "_execute_review_core", fake_core)

    agent.process_review_from_s3(
        document_bucket="bucket",
        document_paths=document_paths,
        check_name="check",
        check_description="description",
        model_id=MODEL_ID,
    )
    return seen


def _document_names(monkeypatch, file_paths):
    """The document names _run_agent_with_document_block would send."""
    sent = {}

    class FakeAgent:
        def __init__(self, **kwargs):
            pass

        def __call__(self, content):
            sent["content"] = content
            raise Sent

    monkeypatch.setattr(agent, "Agent", FakeAgent)
    with pytest.raises(Sent):
        agent._run_agent_with_document_block("prompt", file_paths, MODEL_ID)
    return [b["document"]["name"] for b in sent["content"] if "document" in b]


def test_same_name_files_are_downloaded_separately(monkeypatch):
    paths = [
        "review/original/doc-1/report.pdf",
        "review/original/doc-2/report.pdf",
    ]
    seen = _review_from_s3(monkeypatch, paths)

    assert len(set(seen["paths"])) == 2
    assert seen["contents"] == paths  # neither download overwrote the other


def test_local_file_keeps_its_extension(monkeypatch):
    """File type detection and model selection read the extension."""
    seen = _review_from_s3(
        monkeypatch,
        ["review/original/doc-1/report.PDF", "review/original/doc-2/photo.png"],
    )

    assert [os.path.splitext(p)[1] for p in seen["paths"]] == [".pdf", ".png"]


def test_same_name_files_get_distinct_document_names(tmp_path, monkeypatch):
    """Covers local files too (the eval path), which skip the S3 download."""
    paths = []
    for folder in ("a", "b"):
        (tmp_path / folder).mkdir()
        path = tmp_path / folder / "report.pdf"
        path.write_bytes(b"%PDF-1.4 " + folder.encode())
        paths.append(str(path))

    names = _document_names(monkeypatch, paths)

    assert len(names) == 2
    assert len(set(names)) == 2


def test_document_names_meet_bedrock_rules(tmp_path, monkeypatch):
    """Bedrock allows only letters, digits, whitespace, hyphens, parentheses
    and square brackets, so a path's slashes and dots must not leak in."""
    path = tmp_path / "報告書 v1.2.pdf"
    path.write_bytes(b"%PDF-1.4")

    [name] = _document_names(monkeypatch, [str(path)])

    assert name.startswith("doc_")
    assert name[len("doc_") :].isalnum()
