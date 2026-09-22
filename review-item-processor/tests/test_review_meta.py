#!/usr/bin/env python3
"""The cost stored for a check item must include cached tokens."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import agent  # noqa: E402

MODEL_ID = "global.anthropic.claude-sonnet-4-6"


class _Result:
    def __init__(self, usage):
        class metrics:
            accumulated_usage = usage

        self.metrics = metrics


def _meta(usage):
    return agent.ReviewMetaTracker(MODEL_ID).get_review_meta(_Result(usage))


def test_total_cost_includes_cache_reads_and_writes():
    # A second check item on the same documents: almost all input is read
    # from the cache and inputTokens is tiny.
    meta = _meta(
        {
            "inputTokens": 44,
            "outputTokens": 22,
            "cacheReadInputTokens": 2143,
            "cacheWriteInputTokens": 0,
        }
    )
    tracker = agent.ReviewMetaTracker(MODEL_ID)
    plain_input_and_output = (
        44 / 1000 * tracker.model.input_per_1k + 22 / 1000 * tracker.model.output_per_1k
    )

    assert meta["cache_read_tokens"] == 2143
    assert meta["cache_read_cost"] > 0
    assert meta["total_cost"] > plain_input_and_output


def test_keeps_the_existing_fields():
    meta = _meta({"inputTokens": 100, "outputTokens": 50})
    for key in ("input_tokens", "output_tokens", "input_cost", "output_cost", "total_cost"):
        assert key in meta
    assert meta["input_tokens"] == 100
    assert meta["cache_write_tokens"] == 0
