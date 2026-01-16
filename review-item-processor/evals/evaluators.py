"""
Custom evaluators for RAPID review agent.

Implements:
- AccuracyEvaluator: Compares agent result vs ground truth
- ConfidenceCalibrationEvaluator: Analyzes confidence scores for HITL safety

These evaluators follow Strands v0.1.2 API:
- evaluate(evaluation_case: EvaluationData) -> list[EvaluationOutput]
- Post-processing extracts data from EvaluationReport for sklearn metrics
"""

from strands_evals.evaluators import Evaluator
from strands_evals.types.evaluation import EvaluationData, EvaluationOutput

from .wrapper import ReviewAgentOutput


class AccuracyEvaluator(Evaluator):
    """
    Evaluates pass/fail correctness.

    Returns simple scores that are post-processed for sklearn metrics
    (recall, precision, F1, false negative rate).
    """

    def evaluate(self, evaluation_case: EvaluationData) -> list[EvaluationOutput]:
        """
        Evaluate accuracy for a single case.

        Args:
            evaluation_case: Contains input, actual_output, expected_output

        Returns:
            List with single EvaluationOutput
        """
        if not evaluation_case.expected_output:
            return [EvaluationOutput(
                score=0.0,
                test_pass=False,
                reason="No expected_output in ground truth",
                label="accuracy"
            )]

        expected_result = evaluation_case.expected_output.get("result")
        actual_output: ReviewAgentOutput = evaluation_case.actual_output

        if not expected_result or not actual_output:
            return [EvaluationOutput(
                score=0.0,
                test_pass=False,
                reason="Missing expected_result or actual_output",
                label="accuracy"
            )]

        # Check correctness
        correct = actual_output.result == expected_result
        score = 1.0 if correct else 0.0

        # Determine error type for HITL analysis
        error_type = None
        if not correct:
            if expected_result == "fail" and actual_output.result == "pass":
                error_type = "false_negative"  # Most critical: missed issue
            elif expected_result == "pass" and actual_output.result == "fail":
                error_type = "false_positive"  # Less critical: unnecessary review

        # Encode metadata in reason for post-processing
        reason = f"expected={expected_result}|actual={actual_output.result}|confidence={actual_output.confidence:.3f}"
        if error_type:
            reason += f"|error={error_type}"

        return [EvaluationOutput(
            score=score,
            test_pass=correct,
            reason=reason,
            label="accuracy"
        )]


class ConfidenceCalibrationEvaluator(Evaluator):
    """
    Evaluates confidence calibration with HITL safety focus.

    Returns simple scores that are post-processed for calibration metrics
    (ECE, Brier score, over-confidence rate, safe threshold).
    """

    def __init__(self, high_confidence_threshold: float = 0.8):
        """
        Initialize evaluator.

        Args:
            high_confidence_threshold: Threshold for "high confidence" (default 0.8)
        """
        super().__init__()
        self.high_confidence_threshold = high_confidence_threshold

    def evaluate(self, evaluation_case: EvaluationData) -> list[EvaluationOutput]:
        """
        Evaluate confidence calibration for a single case.

        Args:
            evaluation_case: Contains input, actual_output, expected_output

        Returns:
            List with single EvaluationOutput
        """
        if not evaluation_case.expected_output:
            return [EvaluationOutput(
                score=0.0,
                test_pass=False,
                reason="No expected_output in ground truth",
                label="confidence_calibration"
            )]

        expected_result = evaluation_case.expected_output.get("result")
        actual_output: ReviewAgentOutput = evaluation_case.actual_output

        if not expected_result or not actual_output:
            return [EvaluationOutput(
                score=0.0,
                test_pass=False,
                reason="Missing expected_result or actual_output",
                label="confidence_calibration"
            )]

        # Check correctness and confidence level
        correct = actual_output.result == expected_result
        confidence = actual_output.confidence
        high_confidence = confidence >= self.high_confidence_threshold

        # Most critical: over-confident wrong prediction (especially false negatives)
        over_confident = high_confidence and not correct
        critical_error = (
            over_confident
            and expected_result == "fail"
            and actual_output.result == "pass"
        )

        # Score: 1.0 if correct, 0.0 if over-confident wrong, 0.5 if under-confident or wrong but not over-confident
        if correct:
            score = 1.0
        elif over_confident:
            score = 0.0  # Most problematic for HITL
        else:
            score = 0.5  # Wrong but at least not over-confident

        # Test passes if not over-confident
        test_pass = not over_confident

        # Encode metadata for post-processing
        reason = f"confidence={confidence:.3f}|correct={int(correct)}|high_conf={int(high_confidence)}"
        if over_confident:
            reason += f"|over_confident=1"
        if critical_error:
            reason += f"|critical_error=1|fn_high_conf=1"

        return [EvaluationOutput(
            score=score,
            test_pass=test_pass,
            reason=reason,
            label="confidence_calibration"
        )]
