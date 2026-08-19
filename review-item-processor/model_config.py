"""
Model configuration and capabilities.

This module centralizes all model-specific settings including:
- Pricing information
- Feature support (document block, citations, caching)
- Model metadata
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional
import logging

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ModelConfig:
    """Model configuration and capabilities"""
    
    model_id: str
    display_name: str
    # Pricing is expressed per 1,000,000 (1M) tokens in USD, matching the
    # Amazon Bedrock pricing page (e.g. Claude Sonnet = $3 / $15 per 1M tokens
    # => input_per_1m=3.0, output_per_1m=15.0). Cost is computed as
    # tokens / 1_000_000 * per_1m (see agent.py).
    input_per_1m: float
    output_per_1m: float
    supports_document_block: bool
    supports_citation: bool
    supports_caching: bool
    notes: Optional[str] = None
    
    @property
    def base_model_id(self) -> str:
        """Get base model ID without region prefix"""
        if "." in self.model_id:
            return self.model_id.split(".", 1)[-1]
        return self.model_id
    
    @staticmethod
    def create(model_id: str) -> ModelConfig:
        """
        Factory method to create ModelConfig.
        
        Handles cross-region inference profiles (us.xxx, eu.xxx, etc.)
        
        Args:
            model_id: Bedrock model ID
            
        Returns:
            ModelConfig instance
        """
        # Direct match
        if model_id in _MODEL_REGISTRY:
            return _MODEL_REGISTRY[model_id]
        
        # Try base model ID (cross-region inference)
        if "." in model_id:
            base_model_id = model_id.split(".", 1)[-1]
            if base_model_id in _MODEL_REGISTRY:
                return _MODEL_REGISTRY[base_model_id]
        
        # Fallback
        logger.warning(f"Model config not found for {model_id}, using defaults")
        return _DEFAULT_CONFIG


# ========================================
# Model Registry
# ========================================

_MODEL_REGISTRY = {
    # Claude 3.7 Sonnet
    "us.anthropic.claude-3-7-sonnet-20250219-v1:0": ModelConfig(
        model_id="us.anthropic.claude-3-7-sonnet-20250219-v1:0",
        display_name="Claude 3.7 Sonnet (US)",
        input_per_1m=3.0,
        output_per_1m=15.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "anthropic.claude-3-7-sonnet-20250219-v1:0": ModelConfig(
        model_id="anthropic.claude-3-7-sonnet-20250219-v1:0",
        display_name="Claude 3.7 Sonnet",
        input_per_1m=3.0,
        output_per_1m=15.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    # Claude 4 Sonnet
    "global.anthropic.claude-sonnet-4-20250514-v1:0": ModelConfig(
        model_id="global.anthropic.claude-sonnet-4-20250514-v1:0",
        display_name="Claude 4 Sonnet (Global)",
        input_per_1m=3.0,
        output_per_1m=15.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "us.anthropic.claude-sonnet-4-20250514-v1:0": ModelConfig(
        model_id="us.anthropic.claude-sonnet-4-20250514-v1:0",
        display_name="Claude 4 Sonnet (US)",
        input_per_1m=3.0,
        output_per_1m=15.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "eu.anthropic.claude-sonnet-4-20250514-v1:0": ModelConfig(
        model_id="eu.anthropic.claude-sonnet-4-20250514-v1:0",
        display_name="Claude 4 Sonnet (EU)",
        input_per_1m=3.0,
        output_per_1m=15.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "apac.anthropic.claude-sonnet-4-20250514-v1:0": ModelConfig(
        model_id="apac.anthropic.claude-sonnet-4-20250514-v1:0",
        display_name="Claude 4 Sonnet (APAC)",
        input_per_1m=3.0,
        output_per_1m=15.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "anthropic.claude-sonnet-4-20250514-v1:0": ModelConfig(
        model_id="anthropic.claude-sonnet-4-20250514-v1:0",
        display_name="Claude 4 Sonnet",
        input_per_1m=3.0,
        output_per_1m=15.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    # Claude 4.5 Sonnet
    "global.anthropic.claude-sonnet-4-5-20250929-v1:0": ModelConfig(
        model_id="global.anthropic.claude-sonnet-4-5-20250929-v1:0",
        display_name="Claude 4.5 Sonnet (Global)",
        input_per_1m=3.0,
        output_per_1m=15.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "us.anthropic.claude-sonnet-4-5-20250929-v1:0": ModelConfig(
        model_id="us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        display_name="Claude 4.5 Sonnet (US)",
        input_per_1m=3.3,
        output_per_1m=16.5,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "eu.anthropic.claude-sonnet-4-5-20250929-v1:0": ModelConfig(
        model_id="eu.anthropic.claude-sonnet-4-5-20250929-v1:0",
        display_name="Claude 4.5 Sonnet (EU)",
        input_per_1m=3.3,
        output_per_1m=16.5,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "jp.anthropic.claude-sonnet-4-5-20250929-v1:0": ModelConfig(
        model_id="jp.anthropic.claude-sonnet-4-5-20250929-v1:0",
        display_name="Claude 4.5 Sonnet (JP)",
        input_per_1m=3.3,
        output_per_1m=16.5,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "anthropic.claude-sonnet-4-5-20250929-v1:0": ModelConfig(
        model_id="anthropic.claude-sonnet-4-5-20250929-v1:0",
        display_name="Claude 4.5 Sonnet",
        input_per_1m=3.0,
        output_per_1m=15.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    # Claude 4.5 Opus
    "global.anthropic.claude-opus-4-5-20251101-v1:0": ModelConfig(
        model_id="global.anthropic.claude-opus-4-5-20251101-v1:0",
        display_name="Claude 4.5 Opus (Global)",
        input_per_1m=5.0,
        output_per_1m=25.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    # Claude Sonnet 4.6
    "global.anthropic.claude-sonnet-4-6": ModelConfig(
        model_id="global.anthropic.claude-sonnet-4-6",
        display_name="Claude Sonnet 4.6 (Global)",
        input_per_1m=3.0,
        output_per_1m=15.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "us.anthropic.claude-sonnet-4-6": ModelConfig(
        model_id="us.anthropic.claude-sonnet-4-6",
        display_name="Claude Sonnet 4.6 (US)",
        input_per_1m=3.3,
        output_per_1m=16.5,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "eu.anthropic.claude-sonnet-4-6": ModelConfig(
        model_id="eu.anthropic.claude-sonnet-4-6",
        display_name="Claude Sonnet 4.6 (EU)",
        input_per_1m=3.3,
        output_per_1m=16.5,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "jp.anthropic.claude-sonnet-4-6": ModelConfig(
        model_id="jp.anthropic.claude-sonnet-4-6",
        display_name="Claude Sonnet 4.6 (JP)",
        input_per_1m=3.3,
        output_per_1m=16.5,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "au.anthropic.claude-sonnet-4-6": ModelConfig(
        model_id="au.anthropic.claude-sonnet-4-6",
        display_name="Claude Sonnet 4.6 (AU)",
        input_per_1m=3.3,
        output_per_1m=16.5,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "anthropic.claude-sonnet-4-6": ModelConfig(
        model_id="anthropic.claude-sonnet-4-6",
        display_name="Claude Sonnet 4.6",
        input_per_1m=3.0,
        output_per_1m=15.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    # Claude Sonnet 5 (launched 2026-07-01, Active).
    # Pricing: standard on-demand is $3 / $15 per 1M input/output tokens
    # (=> input_per_1m=3.0 / output_per_1m=15.0), matching Sonnet 4.5/4.6. A
    # promotional launch price of $2 / $10 per 1M is in effect through
    # 2026-08-31; we record the standard rate here (cost figures are for
    # display/estimation only).
    # 価格は標準レート（プロモ期間 〜2026-08-31 は $2/$10）。請求実績で要確認 (verify against billing).
    # Regional CRIS entries (us.) use +10% per the existing convention.
    # Capabilities follow the Claude 4.x/Sonnet family: document block + Citations
    # API + prompt caching.
    "global.anthropic.claude-sonnet-5": ModelConfig(
        model_id="global.anthropic.claude-sonnet-5",
        display_name="Claude Sonnet 5 (Global)",
        input_per_1m=3.0,   # standard rate; promo $2/1M until 2026-08-31 / 請求実績で要確認
        output_per_1m=15.0,  # standard rate; promo $10/1M until 2026-08-31 / 請求実績で要確認
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "us.anthropic.claude-sonnet-5": ModelConfig(
        model_id="us.anthropic.claude-sonnet-5",
        display_name="Claude Sonnet 5 (US)",
        input_per_1m=3.3,   # +10% CRIS convention; standard rate / 請求実績で要確認
        output_per_1m=16.5,  # +10% CRIS convention; standard rate / 請求実績で要確認
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "anthropic.claude-sonnet-5": ModelConfig(
        model_id="anthropic.claude-sonnet-5",
        display_name="Claude Sonnet 5",
        input_per_1m=3.0,   # standard rate; promo $2/1M until 2026-08-31 / 請求実績で要確認
        output_per_1m=15.0,  # standard rate; promo $10/1M until 2026-08-31 / 請求実績で要確認
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    # Claude Opus 4.6
    "global.anthropic.claude-opus-4-6-v1": ModelConfig(
        model_id="global.anthropic.claude-opus-4-6-v1",
        display_name="Claude Opus 4.6 (Global)",
        input_per_1m=5.0,
        output_per_1m=25.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    # Claude Opus 4.7
    "global.anthropic.claude-opus-4-7": ModelConfig(
        model_id="global.anthropic.claude-opus-4-7",
        display_name="Claude Opus 4.7 (Global)",
        input_per_1m=5.0,
        output_per_1m=25.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "us.anthropic.claude-opus-4-7": ModelConfig(
        model_id="us.anthropic.claude-opus-4-7",
        display_name="Claude Opus 4.7 (US)",
        input_per_1m=5.0,
        output_per_1m=25.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "eu.anthropic.claude-opus-4-7": ModelConfig(
        model_id="eu.anthropic.claude-opus-4-7",
        display_name="Claude Opus 4.7 (EU)",
        input_per_1m=5.0,
        output_per_1m=25.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "jp.anthropic.claude-opus-4-7": ModelConfig(
        model_id="jp.anthropic.claude-opus-4-7",
        display_name="Claude Opus 4.7 (JP)",
        input_per_1m=5.0,
        output_per_1m=25.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "au.anthropic.claude-opus-4-7": ModelConfig(
        model_id="au.anthropic.claude-opus-4-7",
        display_name="Claude Opus 4.7 (AU)",
        input_per_1m=5.0,
        output_per_1m=25.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    # Claude Opus 4.8
    # Pricing is provisional: same as Opus 4.6/4.7 ($5 / $25 per 1M tokens
    # => input_per_1m=5.0 / output_per_1m=25.0).
    # 請求実績で要確認 (provisional, verify against actual billing).
    "global.anthropic.claude-opus-4-8": ModelConfig(
        model_id="global.anthropic.claude-opus-4-8",
        display_name="Claude Opus 4.8 (Global)",
        input_per_1m=5.0,   # provisional, verify against actual billing / 請求実績で要確認
        output_per_1m=25.0,  # provisional, verify against actual billing / 請求実績で要確認
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "us.anthropic.claude-opus-4-8": ModelConfig(
        model_id="us.anthropic.claude-opus-4-8",
        display_name="Claude Opus 4.8 (US)",
        input_per_1m=5.0,   # provisional, verify against actual billing / 請求実績で要確認
        output_per_1m=25.0,  # provisional, verify against actual billing / 請求実績で要確認
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "eu.anthropic.claude-opus-4-8": ModelConfig(
        model_id="eu.anthropic.claude-opus-4-8",
        display_name="Claude Opus 4.8 (EU)",
        input_per_1m=5.0,   # provisional, verify against actual billing / 請求実績で要確認
        output_per_1m=25.0,  # provisional, verify against actual billing / 請求実績で要確認
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "jp.anthropic.claude-opus-4-8": ModelConfig(
        model_id="jp.anthropic.claude-opus-4-8",
        display_name="Claude Opus 4.8 (JP)",
        input_per_1m=5.0,   # provisional, verify against actual billing / 請求実績で要確認
        output_per_1m=25.0,  # provisional, verify against actual billing / 請求実績で要確認
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "au.anthropic.claude-opus-4-8": ModelConfig(
        model_id="au.anthropic.claude-opus-4-8",
        display_name="Claude Opus 4.8 (AU)",
        input_per_1m=5.0,   # provisional, verify against actual billing / 請求実績で要確認
        output_per_1m=25.0,  # provisional, verify against actual billing / 請求実績で要確認
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "anthropic.claude-opus-4-8": ModelConfig(
        model_id="anthropic.claude-opus-4-8",
        display_name="Claude Opus 4.8",
        input_per_1m=5.0,   # provisional, verify against actual billing / 請求実績で要確認
        output_per_1m=25.0,  # provisional, verify against actual billing / 請求実績で要確認
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    # Claude Haiku 4.5
    # Lightweight current-gen Claude (launched 2025-10-16, Active). Model IDs per the
    # AWS Bedrock model card (base + us/eu/jp/au geo + global inference profiles).
    # Pricing follows Anthropic public pricing ($1 / $5 per 1M tokens =>
    # input_per_1m=1.0 / output_per_1m=5.0); regional CRIS entries use +10% per
    # the existing convention.
    # 価格は暫定 (provisional)、請求実績で要確認.
    # Capabilities follow the Claude 4.x family: document block + Citations API + prompt
    # caching (prompt caching is confirmed supported on the model card).
    "global.anthropic.claude-haiku-4-5-20251001-v1:0": ModelConfig(
        model_id="global.anthropic.claude-haiku-4-5-20251001-v1:0",
        display_name="Claude Haiku 4.5 (Global)",
        input_per_1m=1.0,
        output_per_1m=5.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "us.anthropic.claude-haiku-4-5-20251001-v1:0": ModelConfig(
        model_id="us.anthropic.claude-haiku-4-5-20251001-v1:0",
        display_name="Claude Haiku 4.5 (US)",
        input_per_1m=1.1,
        output_per_1m=5.5,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "eu.anthropic.claude-haiku-4-5-20251001-v1:0": ModelConfig(
        model_id="eu.anthropic.claude-haiku-4-5-20251001-v1:0",
        display_name="Claude Haiku 4.5 (EU)",
        input_per_1m=1.1,
        output_per_1m=5.5,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "jp.anthropic.claude-haiku-4-5-20251001-v1:0": ModelConfig(
        model_id="jp.anthropic.claude-haiku-4-5-20251001-v1:0",
        display_name="Claude Haiku 4.5 (JP)",
        input_per_1m=1.1,
        output_per_1m=5.5,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "au.anthropic.claude-haiku-4-5-20251001-v1:0": ModelConfig(
        model_id="au.anthropic.claude-haiku-4-5-20251001-v1:0",
        display_name="Claude Haiku 4.5 (AU)",
        input_per_1m=1.1,
        output_per_1m=5.5,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    "anthropic.claude-haiku-4-5-20251001-v1:0": ModelConfig(
        model_id="anthropic.claude-haiku-4-5-20251001-v1:0",
        display_name="Claude Haiku 4.5",
        input_per_1m=1.0,
        output_per_1m=5.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    # Claude 4 Opus
    "anthropic.claude-opus-4-20250514-v1:0": ModelConfig(
        model_id="anthropic.claude-opus-4-20250514-v1:0",
        display_name="Claude 4 Opus",
        input_per_1m=15.0,
        output_per_1m=75.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    # Claude 3.5 Sonnet
    "anthropic.claude-3-5-sonnet-20241022-v2:0": ModelConfig(
        model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
        display_name="Claude 3.5 Sonnet v2",
        input_per_1m=3.0,
        output_per_1m=15.0,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "anthropic.claude-3-5-sonnet-20240620-v1:0": ModelConfig(
        model_id="anthropic.claude-3-5-sonnet-20240620-v1:0",
        display_name="Claude 3.5 Sonnet v1",
        input_per_1m=3.0,
        output_per_1m=15.0,
        supports_document_block=True,
        supports_citation=False,
        supports_caching=True,
    ),
    
    # Claude 3.5 Haiku
    "anthropic.claude-3-5-haiku-20241022-v1:0": ModelConfig(
        model_id="anthropic.claude-3-5-haiku-20241022-v1:0",
        display_name="Claude 3.5 Haiku",
        input_per_1m=1.0,
        output_per_1m=5.0,
        supports_document_block=True,
        supports_citation=False,
        supports_caching=True,
    ),
    
    # Claude 3 Opus
    "anthropic.claude-3-opus-20240229-v1:0": ModelConfig(
        model_id="anthropic.claude-3-opus-20240229-v1:0",
        display_name="Claude 3 Opus",
        input_per_1m=15.0,
        output_per_1m=75.0,
        supports_document_block=True,
        supports_citation=False,
        supports_caching=True,
    ),
    
    # Claude 3 Sonnet
    "anthropic.claude-3-sonnet-20240229-v1:0": ModelConfig(
        model_id="anthropic.claude-3-sonnet-20240229-v1:0",
        display_name="Claude 3 Sonnet",
        input_per_1m=3.0,
        output_per_1m=15.0,
        supports_document_block=True,
        supports_citation=False,
        supports_caching=True,
    ),
    
    # Claude 3 Haiku
    "anthropic.claude-3-haiku-20240307-v1:0": ModelConfig(
        model_id="anthropic.claude-3-haiku-20240307-v1:0",
        display_name="Claude 3 Haiku",
        input_per_1m=0.25,
        output_per_1m=1.25,
        supports_document_block=True,
        supports_citation=False,
        supports_caching=True,
    ),
    
    # Nova Premier
    "us.amazon.nova-premier-v1:0": ModelConfig(
        model_id="us.amazon.nova-premier-v1:0",
        display_name="Amazon Nova Premier",
        input_per_1m=2.5,
        output_per_1m=12.5,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=False,
    ),
    
    "amazon.nova-premier-v1:0": ModelConfig(
        model_id="amazon.nova-premier-v1:0",
        display_name="Amazon Nova Premier",
        input_per_1m=2.5,
        output_per_1m=12.5,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=False,
    ),
    
    # Nova 2 Omni
    "us.amazon.nova-2-omni-v1:0": ModelConfig(
        model_id="us.amazon.nova-2-omni-v1:0",
        display_name="Amazon Nova 2 Omni",
        input_per_1m=0.3,
        output_per_1m=2.5,
        supports_document_block=True,
        supports_citation=False,
        supports_caching=False,
        notes="Supports document block but not citations (causes InternalServerException)",
    ),
    
    "amazon.nova-2-omni-v1:0": ModelConfig(
        model_id="amazon.nova-2-omni-v1:0",
        display_name="Amazon Nova 2 Omni",
        input_per_1m=0.3,
        output_per_1m=2.5,
        supports_document_block=True,
        supports_citation=False,
        supports_caching=False,
        notes="Supports document block but not citations (causes InternalServerException)",
    ),
}

_DEFAULT_CONFIG = ModelConfig(
    model_id="unknown",
    display_name="Unknown Model",
    input_per_1m=0.0,
    output_per_1m=0.0,
    supports_document_block=False,
    supports_citation=False,
    supports_caching=False,
)
