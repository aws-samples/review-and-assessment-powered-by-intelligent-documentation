#!/usr/bin/env python3
"""
Regression tests for feedback_aggregator decommission.

Verifies that the prompt generation functions no longer inject the historical
feedback section (<HISTORICAL_FEEDBACK>) into the review prompts, while the
other legitimate prompt inputs (check name / description / tool config / language)
are still passed through.

Run with: pytest tests/test_no_feedback_injection.py -v
"""
import os
import sys

# Add parent directory to path so `agent` can be imported.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import agent  # noqa: E402

# Marker string that previously appeared when feedback summaries were injected.
FEEDBACK_MARKER = "<HISTORICAL_FEEDBACK>"

# A feedback_summary value that, under the old behaviour, would have been
# embedded verbatim into the prompt. It must NOT appear in any generated prompt.
SAMPLE_FEEDBACK = "PAST_REVIEWER_NOTE: storage area was previously blocking the exit"

CHECK_NAME = "保管スペース確保"
CHECK_DESCRIPTION = "指定エリア内に整理保管され、避難経路を塞いでいない"
LANGUAGE_NAME = "日本語"
MODEL_ID = "us.anthropic.claude-3-7-sonnet-20250219-v1:0"


def test_document_prompt_legacy_has_no_historical_feedback():
    """Legacy (non-citation) document prompt must not contain <HISTORICAL_FEEDBACK>."""
    prompt = agent.get_document_review_prompt(
        LANGUAGE_NAME,
        CHECK_NAME,
        CHECK_DESCRIPTION,
        use_citations=False,
        feedback_summary=SAMPLE_FEEDBACK,
    )
    assert FEEDBACK_MARKER not in prompt
    assert SAMPLE_FEEDBACK not in prompt
    # Legitimate inputs are still present.
    assert CHECK_NAME in prompt
    assert CHECK_DESCRIPTION in prompt
    assert LANGUAGE_NAME in prompt


def test_document_prompt_with_citations_has_no_historical_feedback():
    """Citation document prompt must not contain <HISTORICAL_FEEDBACK>."""
    prompt = agent.get_document_review_prompt(
        LANGUAGE_NAME,
        CHECK_NAME,
        CHECK_DESCRIPTION,
        use_citations=True,
        feedback_summary=SAMPLE_FEEDBACK,
    )
    assert FEEDBACK_MARKER not in prompt
    assert SAMPLE_FEEDBACK not in prompt
    assert CHECK_NAME in prompt
    assert CHECK_DESCRIPTION in prompt
    assert LANGUAGE_NAME in prompt


def test_image_prompt_has_no_historical_feedback():
    """Image review prompt must not contain <HISTORICAL_FEEDBACK>."""
    prompt = agent.get_image_review_prompt(
        LANGUAGE_NAME,
        CHECK_NAME,
        CHECK_DESCRIPTION,
        MODEL_ID,
        feedback_summary=SAMPLE_FEEDBACK,
    )
    assert FEEDBACK_MARKER not in prompt
    assert SAMPLE_FEEDBACK not in prompt
    assert CHECK_NAME in prompt
    assert CHECK_DESCRIPTION in prompt
    assert LANGUAGE_NAME in prompt


def test_document_prompt_identical_with_and_without_feedback_summary():
    """feedback_summary must have no effect on the generated document prompt."""
    base = agent.get_document_review_prompt(
        LANGUAGE_NAME,
        CHECK_NAME,
        CHECK_DESCRIPTION,
        use_citations=False,
        feedback_summary=None,
    )
    with_feedback = agent.get_document_review_prompt(
        LANGUAGE_NAME,
        CHECK_NAME,
        CHECK_DESCRIPTION,
        use_citations=False,
        feedback_summary=SAMPLE_FEEDBACK,
    )
    assert base == with_feedback


def test_image_prompt_identical_with_and_without_feedback_summary():
    """feedback_summary must have no effect on the generated image prompt."""
    base = agent.get_image_review_prompt(
        LANGUAGE_NAME,
        CHECK_NAME,
        CHECK_DESCRIPTION,
        MODEL_ID,
        feedback_summary=None,
    )
    with_feedback = agent.get_image_review_prompt(
        LANGUAGE_NAME,
        CHECK_NAME,
        CHECK_DESCRIPTION,
        MODEL_ID,
        feedback_summary=SAMPLE_FEEDBACK,
    )
    assert base == with_feedback


def test_build_feedback_section_helper_removed():
    """The _build_feedback_section helper must no longer exist on the module."""
    assert not hasattr(agent, "_build_feedback_section")
