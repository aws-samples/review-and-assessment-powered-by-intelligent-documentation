"""
Post-processing functions for calculating sklearn metrics from Strands EvaluationReport.

This module extracts data from EvaluationReport and calculates:
- Accuracy metrics: recall, precision, F1, false negative rate
- Confidence calibration: ECE, Brier score, safe thresholds
"""

from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from strands_evals.types.evaluation_report import EvaluationReport


def extract_accuracy_data(report: EvaluationReport) -> tuple[list[int], list[int], list[float]]:
    """
    Extract y_true, y_pred, and confidences from AccuracyEvaluator report.

    Args:
        report: EvaluationReport from AccuracyEvaluator

    Returns:
        Tuple of (y_true, y_pred, confidences)
        where 1=fail (issue detected), 0=pass (no issue)
    """
    y_true = []
    y_pred = []
    confidences = []

    for case_data in report.cases:
        # Handle both dict and object formats
        if isinstance(case_data, dict):
            expected_output = case_data.get("expected_output", {})
            actual_output = case_data.get("actual_output")
        else:
            expected_output = case_data.expected_output if hasattr(case_data, 'expected_output') else {}
            actual_output = case_data.actual_output if hasattr(case_data, 'actual_output') else None

        if not expected_output or not actual_output:
            continue

        # Get expected result
        expected = expected_output.get("result") if isinstance(expected_output, dict) else None
        if not expected:
            continue

        # Get actual result - handle both dict and object
        if isinstance(actual_output, dict):
            actual_result = actual_output.get("result")
            confidence = actual_output.get("confidence", 0.5)
        else:
            actual_result = actual_output.result
            confidence = actual_output.confidence

        if not actual_result:
            continue

        # Convert to binary: 1=fail (issue), 0=pass (no issue)
        # This makes recall meaningful: "caught X% of actual issues"
        y_true.append(1 if expected == "fail" else 0)
        y_pred.append(1 if actual_result == "fail" else 0)
        confidences.append(confidence)

    return y_true, y_pred, confidences


def calculate_sklearn_metrics(report: EvaluationReport) -> dict[str, Any]:
    """
    Calculate accuracy, recall, precision, F1 from AccuracyEvaluator report.

    Args:
        report: EvaluationReport from AccuracyEvaluator

    Returns:
        Dictionary with sklearn metrics and error analysis
    """
    y_true, y_pred, confidences = extract_accuracy_data(report)

    if not y_true:
        return {"error": "No valid test cases"}

    # Calculate core metrics
    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    cm = confusion_matrix(y_true, y_pred).tolist()

    # Calculate error rates
    total = len(y_true)
    false_negatives = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    false_positives = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn_rate = false_negatives / total if total > 0 else 0
    fp_rate = false_positives / total if total > 0 else 0

    # Identify specific error cases
    false_negative_cases = []
    false_positive_cases = []

    for i, (t, p, conf, case_data) in enumerate(zip(y_true, y_pred, confidences, report.cases)):
        # Get case name from either dict or object
        if isinstance(case_data, dict):
            case_name = case_data.get("name", f"case_{i}")
        else:
            case_name = case_data.name if hasattr(case_data, 'name') else f"case_{i}"

        if t == 1 and p == 0:  # False negative
            false_negative_cases.append({
                "case_index": i,
                "case_name": case_name,
                "confidence": conf,
                "expected": "fail",
                "actual": "pass",
            })
        elif t == 0 and p == 1:  # False positive
            false_positive_cases.append({
                "case_index": i,
                "case_name": case_name,
                "confidence": conf,
                "expected": "pass",
                "actual": "fail",
            })

    return {
        "accuracy": float(acc),
        "precision": float(prec),
        "recall": float(rec),  # PRIMARY for HITL
        "f1_score": float(f1),
        "confusion_matrix": cm,
        "false_negative_rate": float(fn_rate),
        "false_positive_rate": float(fp_rate),
        "false_negative_count": false_negatives,
        "false_positive_count": false_positives,
        "false_negative_cases": false_negative_cases,
        "false_positive_cases": false_positives,
        "total_cases": total,
    }


def extract_calibration_data(report: EvaluationReport) -> tuple[list[float], list[bool]]:
    """
    Extract confidences and correctness flags from ConfidenceCalibrationEvaluator report.

    Args:
        report: EvaluationReport from ConfidenceCalibrationEvaluator

    Returns:
        Tuple of (confidences, correct_flags)
    """
    confidences = []
    correct_flags = []

    for case_data in report.cases:
        # Handle both dict and object formats
        if isinstance(case_data, dict):
            expected_output = case_data.get("expected_output", {})
            actual_output = case_data.get("actual_output")
        else:
            expected_output = case_data.expected_output if hasattr(case_data, 'expected_output') else {}
            actual_output = case_data.actual_output if hasattr(case_data, 'actual_output') else None

        if not expected_output or not actual_output:
            continue

        # Get expected result
        expected = expected_output.get("result") if isinstance(expected_output, dict) else None
        if not expected:
            continue

        # Get actual result - handle both dict and object
        if isinstance(actual_output, dict):
            actual_result = actual_output.get("result")
            confidence = actual_output.get("confidence", 0.5)
        else:
            actual_result = actual_output.result
            confidence = actual_output.confidence

        if not actual_result:
            continue

        confidences.append(confidence)
        correct_flags.append(actual_result == expected)

    return confidences, correct_flags




def find_safe_threshold(
    confidences: list[float], correct_flags: list[bool]
) -> dict[str, Any]:
    """
    Find safe operating threshold for auto-approval.

    Args:
        confidences: List of confidence scores
        correct_flags: List of correctness flags

    Returns:
        Dictionary with threshold analysis and recommendation
    """
    thresholds = [0.70, 0.75, 0.80, 0.85, 0.90, 0.93, 0.95]
    results = []

    for threshold in thresholds:
        above_threshold = [
            (conf, correct)
            for conf, correct in zip(confidences, correct_flags)
            if conf >= threshold
        ]

        if not above_threshold:
            continue

        total = len(above_threshold)
        correct_count = sum(1 for _, correct in above_threshold if correct)
        accuracy = correct_count / total if total > 0 else 0

        # Calculate false negative rate at this threshold
        fn_count = sum(1 for _, correct in above_threshold if not correct)
        fn_rate = fn_count / total if total > 0 else 0

        results.append(
            {
                "threshold": threshold,
                "accuracy": float(accuracy),
                "false_negative_rate": float(fn_rate),
                "predictions_count": total,
            }
        )

    # Recommend threshold with <5% FN rate and sufficient samples
    recommended = None
    for result in results:
        if result["false_negative_rate"] <= 0.05 and result["predictions_count"] >= 3:
            recommended = result
            break

    return {
        "thresholds_analysis": results,
        "recommended": recommended,
    }


def calculate_calibration_metrics(report: EvaluationReport, high_confidence_threshold: float = 0.8) -> dict[str, Any]:
    """
    Calculate confidence calibration metrics from ConfidenceCalibrationEvaluator report.

    Args:
        report: EvaluationReport from ConfidenceCalibrationEvaluator
        high_confidence_threshold: Threshold for "high confidence" (default 0.8)

    Returns:
        Dictionary with calibration metrics for HITL safety
    """
    confidences, correct_flags = extract_calibration_data(report)

    if not confidences:
        return {"error": "No valid test cases"}

    # High confidence analysis (HITL critical)
    high_conf_predictions = [
        (conf, correct)
        for conf, correct in zip(confidences, correct_flags)
        if conf >= high_confidence_threshold
    ]

    high_conf_total = len(high_conf_predictions)
    high_conf_correct = sum(1 for _, correct in high_conf_predictions if correct)
    over_confidence_rate = (
        (high_conf_total - high_conf_correct) / high_conf_total
        if high_conf_total > 0
        else 0
    )

    # Low confidence analysis
    low_conf_predictions = [
        (conf, correct)
        for conf, correct in zip(confidences, correct_flags)
        if conf < 0.5
    ]

    low_conf_total = len(low_conf_predictions)
    low_conf_correct = sum(1 for _, correct in low_conf_predictions if correct)
    under_confidence_rate = (
        low_conf_correct / low_conf_total if low_conf_total > 0 else 0
    )

    # Critical errors (from report reasons)
    critical_errors = []
    for i, reason in enumerate(report.reasons):
        if "critical_error=1" in reason or "fn_high_conf=1" in reason:
            case_dict = report.cases[i]
            critical_errors.append({
                "case_index": i,
                "case_name": case_dict.get("name", f"case_{i}"),
                "confidence": case_dict.get("actual_output").confidence,
                "expected": case_dict.get("expected_output", {}).get("result"),
                "actual": case_dict.get("actual_output").result,
            })

    # Find safe threshold
    safe_threshold = find_safe_threshold(confidences, correct_flags)

    return {
        "over_confidence_rate": float(over_confidence_rate),
        "under_confidence_rate": float(under_confidence_rate),
        "high_confidence_predictions": high_conf_total,
        "high_confidence_correct": high_conf_correct,
        "low_confidence_predictions": low_conf_total,
        "low_confidence_correct": low_conf_correct,
        "critical_errors": critical_errors,
        "critical_error_count": len(critical_errors),
        "safe_operating_threshold": safe_threshold,
        "total_cases": len(confidences),
    }


def calculate_explanation_quality_metrics(report: EvaluationReport) -> dict[str, Any]:
    """
    Calculate explanation quality metrics from OutputEvaluator report.

    Args:
        report: EvaluationReport from OutputEvaluator (LLM-as-judge)

    Returns:
        Dictionary with explanation quality metrics
    """
    if not report.scores:
        return {"error": "No explanation quality scores"}

    scores = report.scores
    mean_score = float(np.mean(scores))
    min_score = float(np.min(scores))
    max_score = float(np.max(scores))

    # Count low quality explanations (score < 0.5)
    low_quality_count = sum(1 for s in scores if s < 0.5)

    # Identify cases with low explanation quality
    low_quality_cases = []
    for i, (score, test_pass) in enumerate(zip(scores, report.test_passes)):
        if score < 0.5:
            case_dict = report.cases[i] if i < len(report.cases) else {}
            low_quality_cases.append({
                "case_index": i,
                "case_name": case_dict.get("name", f"case_{i}") if isinstance(case_dict, dict) else f"case_{i}",
                "score": score,
                "test_pass": test_pass,
            })

    return {
        "mean_score": mean_score,
        "min_score": min_score,
        "max_score": max_score,
        "low_quality_count": low_quality_count,
        "low_quality_cases": low_quality_cases,
        "total_cases": len(scores),
    }
