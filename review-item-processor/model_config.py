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
    input_per_1k: float
    output_per_1k: float
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
        input_per_1k=0.003,
        output_per_1k=0.015,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "anthropic.claude-3-7-sonnet-20250219-v1:0": ModelConfig(
        model_id="anthropic.claude-3-7-sonnet-20250219-v1:0",
        display_name="Claude 3.7 Sonnet",
        input_per_1k=0.003,
        output_per_1k=0.015,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    # Claude 4 Sonnet
    "global.anthropic.claude-sonnet-4-20250514-v1:0": ModelConfig(
        model_id="global.anthropic.claude-sonnet-4-20250514-v1:0",
        display_name="Claude 4 Sonnet (Global)",
        input_per_1k=0.003,
        output_per_1k=0.015,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "us.anthropic.claude-sonnet-4-20250514-v1:0": ModelConfig(
        model_id="us.anthropic.claude-sonnet-4-20250514-v1:0",
        display_name="Claude 4 Sonnet (US)",
        input_per_1k=0.003,
        output_per_1k=0.015,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "eu.anthropic.claude-sonnet-4-20250514-v1:0": ModelConfig(
        model_id="eu.anthropic.claude-sonnet-4-20250514-v1:0",
        display_name="Claude 4 Sonnet (EU)",
        input_per_1k=0.003,
        output_per_1k=0.015,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "apac.anthropic.claude-sonnet-4-20250514-v1:0": ModelConfig(
        model_id="apac.anthropic.claude-sonnet-4-20250514-v1:0",
        display_name="Claude 4 Sonnet (APAC)",
        input_per_1k=0.003,
        output_per_1k=0.015,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "anthropic.claude-sonnet-4-20250514-v1:0": ModelConfig(
        model_id="anthropic.claude-sonnet-4-20250514-v1:0",
        display_name="Claude 4 Sonnet",
        input_per_1k=0.003,
        output_per_1k=0.015,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    # Claude 4.5 Sonnet
    "global.anthropic.claude-sonnet-4-5-20250929-v1:0": ModelConfig(
        model_id="global.anthropic.claude-sonnet-4-5-20250929-v1:0",
        display_name="Claude 4.5 Sonnet (Global)",
        input_per_1k=0.003,
        output_per_1k=0.015,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "us.anthropic.claude-sonnet-4-5-20250929-v1:0": ModelConfig(
        model_id="us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        display_name="Claude 4.5 Sonnet (US)",
        input_per_1k=0.0033,
        output_per_1k=0.0165,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "eu.anthropic.claude-sonnet-4-5-20250929-v1:0": ModelConfig(
        model_id="eu.anthropic.claude-sonnet-4-5-20250929-v1:0",
        display_name="Claude 4.5 Sonnet (EU)",
        input_per_1k=0.0033,
        output_per_1k=0.0165,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "jp.anthropic.claude-sonnet-4-5-20250929-v1:0": ModelConfig(
        model_id="jp.anthropic.claude-sonnet-4-5-20250929-v1:0",
        display_name="Claude 4.5 Sonnet (JP)",
        input_per_1k=0.0033,
        output_per_1k=0.0165,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "anthropic.claude-sonnet-4-5-20250929-v1:0": ModelConfig(
        model_id="anthropic.claude-sonnet-4-5-20250929-v1:0",
        display_name="Claude 4.5 Sonnet",
        input_per_1k=0.003,
        output_per_1k=0.015,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    # Claude 4.5 Opus
    "global.anthropic.claude-opus-4-5-20251101-v1:0": ModelConfig(
        model_id="global.anthropic.claude-opus-4-5-20251101-v1:0",
        display_name="Claude 4.5 Opus (Global)",
        input_per_1k=0.005,
        output_per_1k=0.025,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),

    # Claude 4 Opus
    "anthropic.claude-opus-4-20250514-v1:0": ModelConfig(
        model_id="anthropic.claude-opus-4-20250514-v1:0",
        display_name="Claude 4 Opus",
        input_per_1k=0.015,
        output_per_1k=0.075,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    # Claude 3.5 Sonnet
    "anthropic.claude-3-5-sonnet-20241022-v2:0": ModelConfig(
        model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
        display_name="Claude 3.5 Sonnet v2",
        input_per_1k=0.003,
        output_per_1k=0.015,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    
    "anthropic.claude-3-5-sonnet-20240620-v1:0": ModelConfig(
        model_id="anthropic.claude-3-5-sonnet-20240620-v1:0",
        display_name="Claude 3.5 Sonnet v1",
        input_per_1k=0.003,
        output_per_1k=0.015,
        supports_document_block=True,
        supports_citation=False,
        supports_caching=True,
    ),
    
    # Claude 3.5 Haiku
    "anthropic.claude-3-5-haiku-20241022-v1:0": ModelConfig(
        model_id="anthropic.claude-3-5-haiku-20241022-v1:0",
        display_name="Claude 3.5 Haiku",
        input_per_1k=0.001,
        output_per_1k=0.005,
        supports_document_block=True,
        supports_citation=False,
        supports_caching=True,
    ),
    
    # Claude 3 Opus
    "anthropic.claude-3-opus-20240229-v1:0": ModelConfig(
        model_id="anthropic.claude-3-opus-20240229-v1:0",
        display_name="Claude 3 Opus",
        input_per_1k=0.015,
        output_per_1k=0.075,
        supports_document_block=True,
        supports_citation=False,
        supports_caching=True,
    ),
    
    # Claude 3 Sonnet
    "anthropic.claude-3-sonnet-20240229-v1:0": ModelConfig(
        model_id="anthropic.claude-3-sonnet-20240229-v1:0",
        display_name="Claude 3 Sonnet",
        input_per_1k=0.003,
        output_per_1k=0.015,
        supports_document_block=True,
        supports_citation=False,
        supports_caching=True,
    ),
    
    # Claude 3 Haiku
    "anthropic.claude-3-haiku-20240307-v1:0": ModelConfig(
        model_id="anthropic.claude-3-haiku-20240307-v1:0",
        display_name="Claude 3 Haiku",
        input_per_1k=0.00025,
        output_per_1k=0.00125,
        supports_document_block=True,
        supports_citation=False,
        supports_caching=True,
    ),
    
    # Nova Premier
    "us.amazon.nova-premier-v1:0": ModelConfig(
        model_id="us.amazon.nova-premier-v1:0",
        display_name="Amazon Nova Premier",
        input_per_1k=0.0025,
        output_per_1k=0.0125,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=False,
    ),
    
    "amazon.nova-premier-v1:0": ModelConfig(
        model_id="amazon.nova-premier-v1:0",
        display_name="Amazon Nova Premier",
        input_per_1k=0.0025,
        output_per_1k=0.0125,
        supports_document_block=True,
        supports_citation=True,
        supports_caching=False,
    ),
    
    # Nova 2 Omni
    "us.amazon.nova-2-omni-v1:0": ModelConfig(
        model_id="us.amazon.nova-2-omni-v1:0",
        display_name="Amazon Nova 2 Omni",
        input_per_1k=0.0003,
        output_per_1k=0.0025,
        supports_document_block=True,
        supports_citation=False,
        supports_caching=False,
        notes="Supports document block but not citations (causes InternalServerException)",
    ),
    
    "amazon.nova-2-omni-v1:0": ModelConfig(
        model_id="amazon.nova-2-omni-v1:0",
        display_name="Amazon Nova 2 Omni",
        input_per_1k=0.0003,
        output_per_1k=0.0025,
        supports_document_block=True,
        supports_citation=False,
        supports_caching=False,
        notes="Supports document block but not citations (causes InternalServerException)",
    ),
}

_DEFAULT_CONFIG = ModelConfig(
    model_id="unknown",
    display_name="Unknown Model",
    input_per_1k=0.0,
    output_per_1k=0.0,
    supports_document_block=False,
    supports_citation=False,
    supports_caching=False,
)
