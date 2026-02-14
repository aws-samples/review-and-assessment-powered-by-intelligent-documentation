"""
Evaluation framework for RAPID review agent.

Uses strands-agents-evals SDK with hybrid approach:
- Strands handles experiment orchestration
- Custom post-processing for sklearn metrics (recall, precision, F1)

Evaluates agent across 4 dimensions:
- Accuracy: Pass/fail correctness
- Confidence Calibration: HITL safety (over-confidence, safe thresholds)
- Explanation Quality: Clarity, evidence, completeness
- Tool Usage Efficiency: Tool selection and parameter appropriateness
"""

from .evaluators import AccuracyEvaluator, ConfidenceCalibrationEvaluator
from .experiments import (
    create_accuracy_experiment,
    create_comprehensive_experiment,
    create_tool_efficiency_experiment,
)
from .metrics import (
    calculate_calibration_metrics,
    calculate_explanation_quality_metrics,
    calculate_sklearn_metrics,
)
from .wrapper import (
    ReviewAgentInput,
    ReviewAgentOutput,
    load_test_case_from_json,
    load_test_suite_from_json,
    run_review_agent,
)

__all__ = [
    # Models
    "ReviewAgentInput",
    "ReviewAgentOutput",
    # Agent execution
    "run_review_agent",
    # Test case loading
    "load_test_case_from_json",
    "load_test_suite_from_json",
    # Custom evaluators
    "AccuracyEvaluator",
    "ConfidenceCalibrationEvaluator",
    # Experiment factories
    "create_accuracy_experiment",
    "create_comprehensive_experiment",
    "create_tool_efficiency_experiment",
    # Post-processing metrics
    "calculate_sklearn_metrics",
    "calculate_calibration_metrics",
    "calculate_explanation_quality_metrics",
]
