"""
Pre-configured experiment factories - USE THESE, DON'T MODIFY

This file provides ready-to-use experiment configurations:
- create_accuracy_experiment() - Standard evaluation (accuracy + calibration)
- create_comprehensive_experiment() - All metrics (adds explanation + tool usage)
- create_tool_efficiency_experiment() - Tool usage focus

These are FACTORY FUNCTIONS - they create experiments for you. You don't need to
modify this file. Just import and use them in your evaluation scripts.

Usage:
    from evals import create_accuracy_experiment, run_review_agent
    from evals import load_test_suite_from_json

    # Load your test cases
    test_cases = load_test_suite_from_json("my_tests/my_suite.json")

    # Create experiment
    experiment = create_accuracy_experiment(test_cases)

    # Run evaluation
    reports = experiment.run_evaluations(run_review_agent)

    # Calculate metrics
    from evals import calculate_sklearn_metrics, calculate_calibration_metrics
    sklearn_metrics = calculate_sklearn_metrics(reports[0])
    calibration_metrics = calculate_calibration_metrics(reports[1])
"""

from typing import Any

from strands_evals import Case, Experiment
from strands_evals.evaluators import (
    FaithfulnessEvaluator,
    OutputEvaluator,
    ToolSelectionAccuracyEvaluator,
)

from .evaluators import AccuracyEvaluator, ConfidenceCalibrationEvaluator
from .wrapper import ReviewAgentInput


def create_accuracy_experiment(
    test_cases: list[Case[ReviewAgentInput, dict[str, Any]]],
) -> Experiment[ReviewAgentInput, dict[str, Any]]:
    """
    Create standard accuracy evaluation experiment.

    Evaluates:
    - Accuracy (pass/fail correctness) → Post-process for recall, precision, F1
    - Confidence calibration (HITL safety) → Post-process for ECE, Brier, thresholds
    - Explanation quality (LLM-as-judge)
    - Faithfulness (evidence grounding)

    Args:
        test_cases: List of test cases to evaluate

    Returns:
        Configured Experiment object
    """
    evaluators = [
        # Custom evaluators (post-process for sklearn metrics)
        AccuracyEvaluator(),
        ConfidenceCalibrationEvaluator(high_confidence_threshold=0.8),
        # Strands built-in evaluators
        OutputEvaluator(
            rubric="""
Evaluate the explanation quality on a scale of 0.0 to 1.0 based on:

1. **Clarity** (0.2): Is the explanation easy to understand?
   - Clear language and structure
   - Avoids unnecessary jargon
   - Logical flow

2. **Evidence** (0.3): Does it cite specific evidence from documents?
   - References specific document content
   - Includes page numbers or locations
   - Quotes or describes relevant findings

3. **Completeness** (0.2): Does it address all aspects of the check?
   - Covers all relevant criteria
   - No critical omissions
   - Addresses edge cases if present

4. **Language** (0.15): Correct language usage (Japanese/English)?
   - Grammatically correct
   - Appropriate terminology
   - Matches requested language

5. **Relevance** (0.15): Directly addresses the check item?
   - Stays on topic
   - Answers the specific question
   - No irrelevant information

Return a score between 0.0 and 1.0, where:
- 0.9-1.0: Excellent explanation
- 0.7-0.9: Good explanation with minor issues
- 0.5-0.7: Acceptable but needs improvement
- Below 0.5: Poor explanation

Provide your reasoning for the score.
"""
        ),
        FaithfulnessEvaluator(),
    ]

    return Experiment(
        cases=test_cases,
        evaluators=evaluators,
    )


def create_tool_efficiency_experiment(
    test_cases: list[Case[ReviewAgentInput, dict[str, Any]]],
) -> Experiment[ReviewAgentInput, dict[str, Any]]:
    """
    Create tool usage efficiency experiment.

    Focuses on:
    - Tool selection appropriateness
    - Tool usage efficiency
    - Overall accuracy

    Args:
        test_cases: List of test cases with tool usage

    Returns:
        Configured Experiment object
    """
    evaluators = [
        AccuracyEvaluator(),
        ToolSelectionAccuracyEvaluator(),
        OutputEvaluator(
            rubric="""
Evaluate tool usage efficiency on a scale of 0.0 to 1.0 based on:

1. **Appropriateness** (0.4): Were the right tools selected?
   - Tool selection matches the task requirements
   - No missing tools that should have been used
   - No unnecessary tools used

2. **Efficiency** (0.3): Was tool usage efficient?
   - Minimal redundant tool calls
   - Optimal order of tool usage
   - No excessive retries

3. **Effectiveness** (0.3): Did tools contribute to correct result?
   - Tool outputs were relevant
   - Tool results properly integrated into reasoning
   - Tools helped achieve accurate conclusion

Return a score between 0.0 and 1.0 with reasoning.
"""
        ),
    ]

    return Experiment(
        cases=test_cases,
        evaluators=evaluators,
    )


def create_comprehensive_experiment(
    test_cases: list[Case[ReviewAgentInput, dict[str, Any]]],
) -> Experiment[ReviewAgentInput, dict[str, Any]]:
    """
    Create comprehensive evaluation experiment with all evaluators.

    Evaluates all 4 dimensions:
    1. Accuracy (with sklearn post-processing)
    2. Confidence calibration (with calibration post-processing)
    3. Explanation quality (LLM-as-judge)
    4. Tool usage efficiency

    Args:
        test_cases: List of test cases

    Returns:
        Configured Experiment object with all evaluators
    """
    evaluators = [
        # Dimension 1: Accuracy (post-process for recall, precision, F1)
        AccuracyEvaluator(),
        # Dimension 2: Confidence Calibration (post-process for ECE, Brier)
        ConfidenceCalibrationEvaluator(high_confidence_threshold=0.8),
        # Dimension 3: Explanation Quality (LLM-as-judge)
        OutputEvaluator(
            rubric="""
Evaluate explanation quality (0.0-1.0) based on clarity, evidence, completeness, language, and relevance.
See accuracy experiment rubric for detailed criteria.
"""
        ),
        FaithfulnessEvaluator(),
        # Dimension 4: Tool Usage (for cases with tools)
        ToolSelectionAccuracyEvaluator(),
    ]

    return Experiment(
        cases=test_cases,
        evaluators=evaluators,
    )
