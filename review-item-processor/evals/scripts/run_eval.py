#!/usr/bin/env python3
"""
Run evaluations on RAPID review agent.

Usage:
    # Run on test suite
    uv run python -m evals.scripts.run_eval --suite test_cases/example_suite.json

    # Run on single test case
    uv run python -m evals.scripts.run_eval --case test_cases/TC001.json

    # Specify output file
    uv run python -m evals.scripts.run_eval --suite test_cases/example_suite.json --output results.json

    # Verbose mode
    uv run python -m evals.scripts.run_eval --suite test_cases/example_suite.json --verbose
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from evals import (
    calculate_calibration_metrics,
    calculate_explanation_quality_metrics,
    calculate_sklearn_metrics,
    create_accuracy_experiment,
    create_comprehensive_experiment,
    create_tool_efficiency_experiment,
    load_test_case_from_json,
    load_test_suite_from_json,
    run_review_agent,
)


def main():
    parser = argparse.ArgumentParser(
        description="Run evaluations on RAPID review agent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    # Input options
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "--suite",
        type=Path,
        help="Path to test suite JSON file (array of test cases)",
    )
    input_group.add_argument(
        "--case",
        type=Path,
        help="Path to single test case JSON file",
    )

    # Experiment type
    parser.add_argument(
        "--experiment",
        choices=["accuracy", "tool", "comprehensive"],
        default="comprehensive",
        help="Experiment type (default: comprehensive)",
    )

    # Output options
    parser.add_argument(
        "--output",
        type=Path,
        help="Output file for results (default: results/results_TIMESTAMP.json)",
    )

    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Verbose output",
    )

    args = parser.parse_args()

    # Change to evals directory for relative paths
    evals_dir = Path(__file__).parent.parent
    original_dir = Path.cwd()

    try:
        import os
        os.chdir(evals_dir)

        # Load test cases
        if args.suite:
            print(f"Loading test suite: {args.suite}")
            test_cases = load_test_suite_from_json(args.suite)
            print(f"Loaded {len(test_cases)} test cases")
        else:
            print(f"Loading test case: {args.case}")
            test_cases = [load_test_case_from_json(args.case)]

        # Create experiment
        print(f"\nCreating {args.experiment} experiment...")
        if args.experiment == "accuracy":
            experiment = create_accuracy_experiment(test_cases)
        elif args.experiment == "tool":
            experiment = create_tool_efficiency_experiment(test_cases)
        else:
            experiment = create_comprehensive_experiment(test_cases)

        print(f"Experiment has {len(experiment.evaluators)} evaluators")

        # Run evaluations using Experiment API
        print("\n" + "=" * 60)
        print("Running evaluations...")
        print("=" * 60 + "\n")

        try:
            # Run experiment (handles agent execution + evaluation)
            reports = experiment.run_evaluations(run_review_agent)

            print(f"✓ Evaluation complete! Processed {len(test_cases)} case(s)")
            print()

        except Exception as e:
            print(f"✗ Evaluation failed: {e}")
            return 1

        # Post-process for sklearn and calibration metrics
        print("=" * 60)
        print("Calculating metrics...")
        print("=" * 60 + "\n")

        aggregated = {}

        # Extract Strands reports
        # Match reports to evaluators by order (EvaluationReport doesn't have evaluator_label)
        accuracy_report = None
        calibration_report = None
        output_evaluator_report = None

        for i, report in enumerate(reports):
            evaluator_name = experiment.evaluators[i].get_type_name()

            if evaluator_name == "AccuracyEvaluator":
                accuracy_report = report
            elif evaluator_name == "ConfidenceCalibrationEvaluator":
                calibration_report = report
            elif evaluator_name == "OutputEvaluator":
                output_evaluator_report = report

        # Calculate sklearn metrics from AccuracyEvaluator
        if accuracy_report:
            sklearn_metrics = calculate_sklearn_metrics(accuracy_report)
            if "error" not in sklearn_metrics:
                aggregated["AccuracyEvaluator"] = sklearn_metrics
                print("✓ Sklearn metrics calculated")
            else:
                print(f"⚠️  Sklearn metrics error: {sklearn_metrics['error']}")

        # Calculate calibration metrics from ConfidenceCalibrationEvaluator
        if calibration_report:
            calibration_metrics = calculate_calibration_metrics(calibration_report)
            if "error" not in calibration_metrics:
                aggregated["ConfidenceCalibrationEvaluator"] = calibration_metrics
                print("✓ Calibration metrics calculated")
            else:
                print(f"⚠️  Calibration metrics error: {calibration_metrics['error']}")

        # Calculate explanation quality metrics from OutputEvaluator
        if output_evaluator_report:
            explanation_metrics = calculate_explanation_quality_metrics(output_evaluator_report)
            if "error" not in explanation_metrics:
                aggregated["OutputEvaluator"] = explanation_metrics
                print("✓ Explanation quality metrics calculated")
            else:
                print(f"⚠️  Explanation quality metrics error: {explanation_metrics['error']}")

        print()

        # Format case results for storage
        all_reports = []
        for case_idx, case in enumerate(test_cases):
            # Build case data
            case_data = {
                "case_name": case.name,
                "metadata": case.metadata,
            }

            # Extract agent output from first report (all reports share same cases)
            if reports and reports[0].cases and case_idx < len(reports[0].cases):
                eval_case = reports[0].cases[case_idx]
                # Handle both dict and object access patterns
                if isinstance(eval_case, dict):
                    actual_output = eval_case.get('actual_output', {})
                    if isinstance(actual_output, dict):
                        case_data["agent_output"] = {
                            "result": actual_output.get('result'),
                            "confidence": actual_output.get('confidence'),
                            "explanation": actual_output.get('explanation'),
                            "short_explanation": actual_output.get('shortExplanation') or actual_output.get('short_explanation'),
                        }
                else:
                    if hasattr(eval_case, 'actual_output') and hasattr(eval_case.actual_output, 'result'):
                        case_data["agent_output"] = {
                            "result": eval_case.actual_output.result,
                            "confidence": eval_case.actual_output.confidence,
                            "explanation": eval_case.actual_output.explanation,
                            "short_explanation": eval_case.actual_output.short_explanation,
                        }

            # Extract evaluations from each evaluator's report
            evaluations = {}
            for evaluator_idx, report in enumerate(reports):
                evaluator_name = experiment.evaluators[evaluator_idx].get_type_name()

                # Use indexed access - reports are ordered and aligned with test_cases
                if case_idx < len(report.scores):
                    # Get score, reason, and pass/fail for this case
                    score = report.scores[case_idx] if case_idx < len(report.scores) else 0
                    reason = report.reasons[case_idx] if case_idx < len(report.reasons) else ""
                    test_pass = report.test_passes[case_idx] if case_idx < len(report.test_passes) else False

                    evaluations[evaluator_name] = {
                        "score": score,
                        "details": reason,
                        "pass": test_pass,
                    }

            case_data["evaluations"] = evaluations
            all_reports.append(case_data)

        # Save results
        results = {
            "experiment_type": args.experiment,
            "timestamp": datetime.now().isoformat(),
            "total_cases": len(test_cases),
            "successful_cases": len([r for r in all_reports if "error" not in r]),
            "failed_cases": len([r for r in all_reports if "error" in r]),
            "case_results": all_reports,
            "aggregated_metrics": aggregated,
        }

        # Determine output file
        if args.output:
            output_file = original_dir / args.output
        else:
            results_dir = original_dir / "results"
            results_dir.mkdir(exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = results_dir / f"results_{timestamp}.json"

        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

        print(f"\n✓ Results saved to: {output_file}")

        # Print summary
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        print(f"Total cases: {results['total_cases']}")
        print(f"Successful: {results['successful_cases']}")
        print(f"Failed: {results['failed_cases']}")

        if "AccuracyEvaluator" in aggregated:
            acc_metrics = aggregated["AccuracyEvaluator"]
            print(f"\nAccuracy:  {acc_metrics.get('accuracy', 0):.0%}")
            print(f"Recall:    {acc_metrics.get('recall', 0):.0%} ⭐ (Primary metric for HITL)")
            print(f"Precision: {acc_metrics.get('precision', 0):.0%}")
            print(f"F1 Score:  {acc_metrics.get('f1_score', 0):.2f}")

            fn_count = acc_metrics.get('false_negative_count', 0)
            fp_count = acc_metrics.get('false_positive_count', 0)
            print(f"\nFalse Negatives: {fn_count} (missed issues)")
            print(f"False Positives: {fp_count} (unnecessary flags)")

        if "ConfidenceCalibrationEvaluator" in aggregated:
            cal_metrics = aggregated["ConfidenceCalibrationEvaluator"]
            print(f"\nECE (Calibration Error):   {cal_metrics.get('ece', 0):.3f}")
            print(f"Over-Confidence Rate:       {cal_metrics.get('over_confidence_rate', 0):.1%}")
            print(f"Critical Errors (FN@HC):    {cal_metrics.get('critical_error_count', 0)}")

            safe_threshold = cal_metrics.get("safe_operating_threshold", {})
            if safe_threshold.get("recommended"):
                rec = safe_threshold["recommended"]
                print(f"\n✓ Safe Threshold:           {rec['threshold']}")
                print(f"  → Accuracy above threshold: {rec['accuracy']:.0%}")
                print(f"  → FN rate above threshold:  {rec['false_negative_rate']:.1%}")

        # Display explanation quality metrics (optional, LLM-as-judge)
        if "OutputEvaluator" in aggregated:
            exp_metrics = aggregated["OutputEvaluator"]
            print(f"\n{'=' * 60}")
            print("EXPLANATION QUALITY (LLM-as-Judge)")
            print("=" * 60)
            print(f"Mean Score:         {exp_metrics.get('mean_score', 0):.2f}/1.0")
            print(f"Min Score:          {exp_metrics.get('min_score', 0):.2f}")
            print(f"Max Score:          {exp_metrics.get('max_score', 0):.2f}")
            print(f"Low Quality Count:  {exp_metrics.get('low_quality_count', 0)} (score < 0.5)")

        print("\n" + "=" * 60)

    finally:
        os.chdir(original_dir)


if __name__ == "__main__":
    main()
