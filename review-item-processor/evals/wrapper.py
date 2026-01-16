"""
Wrapper module to adapt the RAPID review agent to Strands Evals SDK format.

This module provides:
- ReviewAgentInput/Output: Type-safe input/output models
- run_review_agent: Function that executes the agent and returns structured output
"""

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from strands_evals import Case


@dataclass
class ReviewAgentInput:
    """Input for review agent evaluation."""

    document_paths: list[str]  # Relative paths to fixtures/
    check_name: str
    check_description: str
    language_name: str = "日本語"
    tool_configuration: dict[str, Any] | None = None

    def to_agent_event(self, fixtures_dir: Path) -> dict[str, Any]:
        """Convert to agent event format with absolute paths."""
        return {
            "reviewJobId": "eval-job",
            "checkId": "eval-check",
            "reviewResultId": "eval-result",
            "documentPaths": [
                str(fixtures_dir / path) for path in self.document_paths
            ],
            "checkName": self.check_name,
            "checkDescription": self.check_description,
            "languageName": self.language_name,
            "toolConfiguration": self.tool_configuration or {},
        }


@dataclass
class ReviewAgentOutput:
    """Output from review agent evaluation."""

    result: str  # "pass" | "fail"
    confidence: float
    explanation: str
    short_explanation: str
    tool_usage: list[dict[str, Any]]  # From verificationDetails.sourcesDetails
    review_meta: dict[str, Any]

    # Additional fields for analysis
    extracted_text: str | list[str] | None = None
    page_number: int | None = None
    review_type: str | None = None  # "PDF" | "IMAGE"
    used_image_indexes: list[int] | None = None
    bounding_boxes: list[dict] | None = None


def run_review_agent(
    case: Case[ReviewAgentInput, ReviewAgentOutput],
    use_local_files: bool = True,
) -> ReviewAgentOutput:
    """
    Execute the review agent and return structured output.

    Args:
        case: Test case with input and expected output
        use_local_files: If True, use local files directly (default).
                        If False, upload to S3 first (for production-like testing)

    Returns:
        ReviewAgentOutput with agent results

    Raises:
        Exception: If agent execution fails
    """
    from agent import (
        _run_agent_with_file_read_tool,
        _run_agent_with_document_block,
        get_document_review_prompt,
        get_image_review_prompt,
        ENABLE_CITATIONS,
        DOCUMENT_MODEL_ID,
        IMAGE_MODEL_ID,
        IMAGE_FILE_EXTENSIONS,
    )
    from strands_tools import file_read, image_reader

    # Get fixtures directory - check multiple locations
    evals_dir = Path(__file__).parent
    potential_fixture_dirs = [
        evals_dir / "examples" / "fixtures",     # Demo files
        evals_dir / "my_tests" / "fixtures",     # User test files
        evals_dir / "test_cases" / "fixtures",   # Legacy location
    ]

    if use_local_files:
        # Use local file paths directly (faster for testing)
        document_paths = []
        for doc_path in case.input.document_paths:
            # Try to find file in one of the fixture directories
            found = False
            for fixtures_dir in potential_fixture_dirs:
                full_path = fixtures_dir / doc_path
                if full_path.exists():
                    document_paths.append(str(full_path))
                    found = True
                    break

            if not found:
                # File not found in any fixture directory - raise helpful error
                raise FileNotFoundError(
                    f"Document '{doc_path}' not found in any fixture directory. "
                    f"Checked: {[str(d) for d in potential_fixture_dirs]}"
                )
    else:
        # Upload to S3 and use S3 paths (production-like testing)
        raise NotImplementedError(
            "S3 upload not yet implemented. Use use_local_files=True"
        )

    # Check file types
    has_images = False
    for path in document_paths:
        ext = os.path.splitext(path)[1].lower()
        if ext in IMAGE_FILE_EXTENSIONS:
            has_images = True
            break

    # Select model and prepare prompt
    if has_images:
        selected_model_id = IMAGE_MODEL_ID
        prompt = get_image_review_prompt(
            case.input.language_name,
            case.input.check_name,
            case.input.check_description,
            selected_model_id
        )
        tools = [file_read, image_reader]
        use_citations = False
    else:
        selected_model_id = DOCUMENT_MODEL_ID
        # Check if model supports citations for PDFs
        from model_config import ModelConfig
        model_config = ModelConfig.create(selected_model_id)
        use_citations = ENABLE_CITATIONS and model_config.supports_citation

        prompt = get_document_review_prompt(
            case.input.language_name,
            case.input.check_name,
            case.input.check_description,
            use_citations=use_citations
        )
        tools = [file_read]

    # Execute agent - use appropriate method based on document type and citation support
    try:
        if has_images or not use_citations:
            # Use file_read_tool for images or models without citation support
            result = _run_agent_with_file_read_tool(
                prompt="",  # Empty prompt, system_prompt contains the full prompt
                file_paths=document_paths,
                model_id=selected_model_id,
                system_prompt=prompt,
                temperature=0.1,
                base_tools=tools,
                toolConfiguration=case.input.tool_configuration or {}
            )
        else:
            # Use document block with citations for PDFs (primary use case)
            # Create user message for the document
            files_list = ", ".join([os.path.basename(p) for p in document_paths])
            user_prompt = f"Please analyze the document(s): {files_list}"

            result = _run_agent_with_document_block(
                prompt=user_prompt,
                file_paths=document_paths,
                model_id=selected_model_id,
                system_prompt=prompt,
                temperature=0.1,
                toolConfiguration=case.input.tool_configuration or {}
            )
    except Exception as e:
        raise Exception(f"Agent execution failed: {e}") from e

    # Check if result has required fields
    if not result.get("result"):
        raise Exception(f"Agent did not return a valid result: {result}")

    # Extract tool usage
    tool_usage = result.get("verificationDetails", {}).get("sourcesDetails", [])

    # Create structured output
    return ReviewAgentOutput(
        result=result["result"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        short_explanation=result["shortExplanation"],
        tool_usage=tool_usage,
        review_meta=result.get("reviewMeta", {}),
        extracted_text=result.get("extractedText"),
        page_number=result.get("pageNumber"),
        review_type=result.get("reviewType"),
        used_image_indexes=result.get("usedImageIndexes"),
        bounding_boxes=result.get("boundingBoxes"),
    )


def load_test_case_from_json(json_path: Path) -> Case[ReviewAgentInput, ReviewAgentOutput]:
    """
    Load a test case from JSON file.

    Args:
        json_path: Path to JSON file

    Returns:
        Case object for use with Strands Evals
    """
    with open(json_path) as f:
        data = json.load(f)

    # Parse input
    input_data = data["input"]
    agent_input = ReviewAgentInput(
        document_paths=input_data["document_paths"],
        check_name=input_data["check_name"],
        check_description=input_data["check_description"],
        language_name=input_data.get("language_name", "日本語"),
        tool_configuration=input_data.get("tool_configuration"),
    )

    # Parse expected output (for ground truth comparison)
    expected = data.get("expected_output", {})

    # Create case
    return Case(
        name=data.get("name", data.get("id", "unknown")),
        input=agent_input,
        expected_output=expected,  # Store as dict for flexible evaluation
        metadata=data.get("metadata", {}),
    )


def load_test_suite_from_json(json_path: Path) -> list[Case[ReviewAgentInput, ReviewAgentOutput]]:
    """
    Load a test suite (multiple cases) from JSON file.

    Args:
        json_path: Path to JSON file containing array of test cases

    Returns:
        List of Case objects
    """
    with open(json_path) as f:
        data = json.load(f)

    if isinstance(data, list):
        # Array of test cases
        cases = []
        for item in data:
            # Create temp file for each case
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tmp:
                json.dump(item, tmp)
                tmp_path = Path(tmp.name)

            try:
                case = load_test_case_from_json(tmp_path)
                cases.append(case)
            finally:
                tmp_path.unlink()

        return cases
    else:
        # Single test case
        return [load_test_case_from_json(json_path)]
