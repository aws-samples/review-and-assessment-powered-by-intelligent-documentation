"""Cost of one review call, including prompt caching.

Bedrock does not count cached tokens in ``inputTokens``. They come back in
separate fields, so a cost computed from ``inputTokens`` and ``outputTokens``
alone leaves out almost all of the input: every check item sends the same
documents, and with caching enabled those tokens are reported as cache writes
or cache reads instead.

    first call:  inputTokens=14, cacheWriteInputTokens=3244, cacheReadInputTokens=0
    second call: inputTokens=18, cacheWriteInputTokens=0,    cacheReadInputTokens=3244

Prices relative to standard input tokens (5-minute cache, the default):
- cache write: 1.25x
- cache read: 0.1x
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Optional

# Relative to the standard input token price
CACHE_WRITE_MULTIPLIER = 1.25
CACHE_READ_MULTIPLIER = 0.1


@dataclass(frozen=True)
class TokenCounts:
    """Tokens used by one call: the four kinds Bedrock reports."""

    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0

    @property
    def total_input(self) -> int:
        """All input the model read, cached or not.

        This is a measure of how much was sent, not of cost. inputTokens alone
        looks smaller the better caching works.
        """
        return self.input_tokens + self.cache_read_tokens + self.cache_write_tokens


@dataclass(frozen=True)
class Cost:
    input_cost: float = 0.0
    output_cost: float = 0.0
    cache_read_cost: float = 0.0
    cache_write_cost: float = 0.0

    @property
    def total(self) -> float:
        return (
            self.input_cost
            + self.output_cost
            + self.cache_read_cost
            + self.cache_write_cost
        )


def counts_from_usage(usage: Optional[Mapping[str, Any]]) -> TokenCounts:
    """Read the four token counts from Bedrock usage (as returned by Strands).

    Missing fields, as for models or calls without caching, count as 0, and so
    does anything that is not a number: failing here would throw away a review
    that has already finished, only because its cost could not be computed.
    """
    if not usage:
        return TokenCounts()

    def number(key: str) -> int:
        value = usage.get(key, 0)
        try:
            return max(0, int(value))
        except (TypeError, ValueError):
            return 0

    return TokenCounts(
        input_tokens=number("inputTokens"),
        output_tokens=number("outputTokens"),
        cache_read_tokens=number("cacheReadInputTokens"),
        cache_write_tokens=number("cacheWriteInputTokens"),
    )


def cost_of(
    counts: TokenCounts,
    *,
    input_per_1k: float,
    output_per_1k: float,
    cache_write_per_1k: Optional[float] = None,
    cache_read_per_1k: Optional[float] = None,
) -> Cost:
    """Cost of the given tokens, cache writes and reads included."""
    write_rate = (
        input_per_1k * CACHE_WRITE_MULTIPLIER
        if cache_write_per_1k is None
        else cache_write_per_1k
    )
    read_rate = (
        input_per_1k * CACHE_READ_MULTIPLIER
        if cache_read_per_1k is None
        else cache_read_per_1k
    )
    return Cost(
        input_cost=counts.input_tokens / 1000 * input_per_1k,
        output_cost=counts.output_tokens / 1000 * output_per_1k,
        cache_write_cost=counts.cache_write_tokens / 1000 * write_rate,
        cache_read_cost=counts.cache_read_tokens / 1000 * read_rate,
    )


def saved_by_cache(counts: TokenCounts, *, input_per_1k: float) -> float:
    """How much caching saved compared with sending everything as plain input.

    Negative on a call that only wrote to the cache, since writes cost more
    than plain input; later reads make up for it. Not rounded.
    """
    would_have_paid = counts.total_input / 1000 * input_per_1k
    actually_paid = cost_of(
        counts, input_per_1k=input_per_1k, output_per_1k=0.0
    ).total
    return would_have_paid - actually_paid
