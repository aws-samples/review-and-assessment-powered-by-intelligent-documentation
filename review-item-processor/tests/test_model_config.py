#!/usr/bin/env python3
"""
Tests for model_config.py — Claude Opus 4.8 registration.

Run with: pytest tests/test_model_config.py -v

Covers:
  ModelConfig.create() resolves every form (global / us / eu / jp / au /
  base) of the Opus 4.8 modelId to a registered config.
"""
import os
import sys

import pytest

# Add parent directory to path so `import model_config` works when run from any cwd.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from model_config import ModelConfig, _MODEL_REGISTRY  # noqa: E402


# All six Opus 4.8 forms that must be registered (global / geo / base).
OPUS_4_8_MODEL_IDS = [
    "global.anthropic.claude-opus-4-8",
    "us.anthropic.claude-opus-4-8",
    "eu.anthropic.claude-opus-4-8",
    "jp.anthropic.claude-opus-4-8",
    "au.anthropic.claude-opus-4-8",
    "anthropic.claude-opus-4-8",
]

EXPECTED_DISPLAY_NAMES = {
    "global.anthropic.claude-opus-4-8": "Claude Opus 4.8 (Global)",
    "us.anthropic.claude-opus-4-8": "Claude Opus 4.8 (US)",
    "eu.anthropic.claude-opus-4-8": "Claude Opus 4.8 (EU)",
    "jp.anthropic.claude-opus-4-8": "Claude Opus 4.8 (JP)",
    "au.anthropic.claude-opus-4-8": "Claude Opus 4.8 (AU)",
    "anthropic.claude-opus-4-8": "Claude Opus 4.8",
}


@pytest.mark.parametrize("model_id", OPUS_4_8_MODEL_IDS)
def test_opus_4_8_registered(model_id):
    """Each Opus 4.8 form must be present in the registry."""
    assert model_id in _MODEL_REGISTRY


@pytest.mark.parametrize("model_id", OPUS_4_8_MODEL_IDS)
def test_opus_4_8_capability_flags(model_id):
    """All Opus 4.8 entries support document block / citation / caching."""
    config = ModelConfig.create(model_id)
    assert config.supports_document_block is True
    assert config.supports_citation is True
    assert config.supports_caching is True


@pytest.mark.parametrize("model_id", OPUS_4_8_MODEL_IDS)
def test_opus_4_8_display_name(model_id):
    """Display names match the spec exactly."""
    config = ModelConfig.create(model_id)
    assert config.display_name == EXPECTED_DISPLAY_NAMES[model_id]


@pytest.mark.parametrize("model_id", OPUS_4_8_MODEL_IDS)
def test_opus_4_8_provisional_pricing(model_id):
    """Provisional pricing matches Opus 4.6/4.7 ($5 / $25 per 1M tokens)."""
    config = ModelConfig.create(model_id)
    assert config.input_per_1m == 5.0
    assert config.output_per_1m == 25.0


def test_opus_4_8_unknown_region_falls_back_to_base():
    """
    An unregistered region prefix for Opus 4.8 falls back via base model id
    (create() strips the region prefix) and resolves to the base entry.
    """
    config = ModelConfig.create("ap.anthropic.claude-opus-4-8")
    assert config.display_name == "Claude Opus 4.8"
