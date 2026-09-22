#!/usr/bin/env python3
"""Tests for review cost: cached tokens must be counted."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pricing import (  # noqa: E402
    TokenCounts,
    cost_of,
    counts_from_usage,
    saved_by_cache,
)

INPUT = 0.003
OUTPUT = 0.015


class TestCountsFromUsage:
    # Bedrock reports cached tokens in their own fields, not in inputTokens
    def test_takes_the_cache_columns_as_well(self):
        counts = counts_from_usage(
            {
                "inputTokens": 18,
                "outputTokens": 8,
                "cacheReadInputTokens": 3244,
                "cacheWriteInputTokens": 0,
            }
        )
        assert counts.input_tokens == 18
        assert counts.cache_read_tokens == 3244

    def test_says_zero_when_the_model_reports_no_cache(self):
        counts = counts_from_usage({"inputTokens": 100, "outputTokens": 20})
        assert counts.cache_read_tokens == 0
        assert counts.cache_write_tokens == 0

    def test_says_zero_when_there_is_no_usage_at_all(self):
        assert counts_from_usage(None) == TokenCounts()

    # Failing here would throw away a review that has already finished
    def test_survives_a_value_that_is_not_a_number(self):
        counts = counts_from_usage({"inputTokens": "many", "outputTokens": None})
        assert counts.input_tokens == 0
        assert counts.output_tokens == 0

    def test_counts_everything_the_model_read(self):
        counts = TokenCounts(
            input_tokens=100, cache_read_tokens=3000, cache_write_tokens=500
        )
        assert counts.total_input == 3600


class TestCostOf:
    def test_charges_for_the_cached_tokens_too(self):
        counts = TokenCounts(input_tokens=1000, output_tokens=1000)
        without_cache = cost_of(counts, input_per_1k=INPUT, output_per_1k=OUTPUT)

        cached = TokenCounts(
            input_tokens=1000, output_tokens=1000, cache_read_tokens=10_000
        )
        with_cache = cost_of(cached, input_per_1k=INPUT, output_per_1k=OUTPUT)

        assert with_cache.total > without_cache.total

    def test_reads_from_cache_cost_a_tenth_of_standard_input(self):
        counts = TokenCounts(cache_read_tokens=10_000)
        cost = cost_of(counts, input_per_1k=INPUT, output_per_1k=OUTPUT)
        assert cost.cache_read_cost == 10 * INPUT * 0.1

    def test_writes_to_cache_cost_a_quarter_more_than_standard_input(self):
        counts = TokenCounts(cache_write_tokens=10_000)
        cost = cost_of(counts, input_per_1k=INPUT, output_per_1k=OUTPUT)
        assert cost.cache_write_cost == 10 * INPUT * 1.25

    def test_uses_the_rate_the_model_gives_when_there_is_one(self):
        counts = TokenCounts(cache_read_tokens=1000)
        cost = cost_of(
            counts,
            input_per_1k=INPUT,
            output_per_1k=OUTPUT,
            cache_read_per_1k=0.001,
        )
        assert cost.cache_read_cost == 0.001

    def test_adds_the_four_parts_up(self):
        counts = TokenCounts(
            input_tokens=1000,
            output_tokens=1000,
            cache_read_tokens=1000,
            cache_write_tokens=1000,
        )
        cost = cost_of(counts, input_per_1k=INPUT, output_per_1k=OUTPUT)
        assert cost.total == pytest_approx(
            INPUT + OUTPUT + INPUT * 0.1 + INPUT * 1.25
        )

    # The old cost left out the documents entirely
    def test_shows_how_much_was_missing_before(self):
        counts = counts_from_usage(
            {
                "inputTokens": 18,
                "outputTokens": 800,
                "cacheReadInputTokens": 20_000,
                "cacheWriteInputTokens": 0,
            }
        )
        old_way = (18 / 1000 * INPUT) + (800 / 1000 * OUTPUT)
        now = cost_of(counts, input_per_1k=INPUT, output_per_1k=OUTPUT).total
        assert now > old_way


class TestSavedByCache:
    def test_says_what_the_cache_saved_on_a_reused_document(self):
        counts = TokenCounts(cache_read_tokens=10_000)
        # Without caching, the 10,000 tokens would be charged as plain input
        assert saved_by_cache(counts, input_per_1k=INPUT) == pytest_approx(
            10 * INPUT - 10 * INPUT * 0.1
        )

    # A write costs more than plain input; later reads make up for it
    def test_can_be_negative_on_the_call_that_fills_the_cache(self):
        counts = TokenCounts(cache_write_tokens=10_000)
        assert saved_by_cache(counts, input_per_1k=INPUT) < 0

    def test_is_nothing_when_the_cache_was_not_used(self):
        counts = TokenCounts(input_tokens=1000, output_tokens=500)
        assert saved_by_cache(counts, input_per_1k=INPUT) == 0


def pytest_approx(value):
    import pytest

    return pytest.approx(value)
