"""
Template Variable Expansion for Next Action Generation

This module expands template variables in prompt templates with actual data.

TEMPLATE VARIABLES:
- {{failed_items}} - Failed items with details (rule name, AI judgment, explanation)
- {{user_overrides}} - Items that users overrode with their comments
- {{all_results}} - All review results
- {{document_info}} - Review document information
- {{checklist_name}} - Checklist name
- {{pass_count}} - Number of passed items
- {{fail_count}} - Number of failed items
"""
import json
from typing import Any, Dict, List


def expand_template_variables(template: str, data: Dict[str, Any]) -> str:
    """
    Expand template variables in the prompt template.

    Args:
        template: The prompt template with {{variable}} placeholders
        data: Dictionary containing the data to expand

    Returns:
        The expanded prompt with variables replaced by actual values
    """
    result = template

    # {{failed_items}}
    result = result.replace(
        "{{failed_items}}", format_failed_items(data.get("failedItems", []))
    )

    # {{user_overrides}}
    result = result.replace(
        "{{user_overrides}}", format_user_overrides(data.get("userOverrides", []))
    )

    # {{all_results}}
    result = result.replace(
        "{{all_results}}", format_all_results(data.get("allResults", []))
    )

    # {{document_info}}
    result = result.replace(
        "{{document_info}}", format_document_info(data.get("documents", []))
    )

    # {{checklist_name}}
    result = result.replace("{{checklist_name}}", data.get("checklistName", ""))

    # {{pass_count}}
    result = result.replace("{{pass_count}}", str(data.get("passCount", 0)))

    # {{fail_count}}
    result = result.replace("{{fail_count}}", str(data.get("failCount", 0)))

    return result


def format_failed_items(items: List[Dict[str, Any]]) -> str:
    """Format failed items for the prompt."""
    if not items:
        return "No failed items."

    formatted = []
    for item in items:
        parts = [f"- **{item.get('checkList', {}).get('name', 'Unknown')}**: Failed"]

        confidence = item.get("confidenceScore")
        if confidence is not None:
            parts[0] += f" (Confidence: {int(confidence * 100)}%)"

        description = item.get("checkList", {}).get("description")
        if description:
            parts.append(f"  Rule: {description}")

        explanation = item.get("explanation")
        if explanation:
            parts.append(f"  Explanation: {explanation}")

        extracted_text = item.get("extractedText")
        if extracted_text:
            parsed = parse_extracted_text(extracted_text)
            if parsed:
                parts.append(f'  Extracted text: "{"\", \"".join(parsed[:3])}"')

        formatted.append("\n".join(parts))

    return "\n\n".join(formatted)


def format_user_overrides(items: List[Dict[str, Any]]) -> str:
    """Format user override items for the prompt."""
    if not items:
        return "No user overrides."

    formatted = []
    for item in items:
        result = item.get("result", "unknown")
        ai_result = "Pass" if result == "pass" else "Fail" if result == "fail" else "Unknown"
        overridden_to = "Fail" if result == "pass" else "Pass"

        parts = [
            f"- **{item.get('checkList', {}).get('name', 'Unknown')}**: AI judged {ai_result} -> User changed to {overridden_to}"
        ]

        user_comment = item.get("userComment")
        if user_comment:
            parts.append(f"  Comment: {user_comment}")

        formatted.append("\n".join(parts))

    return "\n\n".join(formatted)


def format_all_results(items: List[Dict[str, Any]]) -> str:
    """Format all review results for the prompt."""
    if not items:
        return "No results available."

    formatted = []
    for item in items:
        result = item.get("result", "pending")
        result_text = "Pass" if result == "pass" else "Fail" if result == "fail" else "Pending"
        override = " (User Override)" if item.get("userOverride") else ""

        formatted.append(
            f"- **{item.get('checkList', {}).get('name', 'Unknown')}**: {result_text}{override}"
        )

    return "\n".join(formatted)


def format_document_info(documents: List[Dict[str, Any]]) -> str:
    """Format document info for the prompt."""
    if not documents:
        return "No documents."

    return "\n".join([f"- {doc.get('filename', 'Unknown')}" for doc in documents])


def parse_extracted_text(value: str) -> List[str]:
    """Parse extracted text which may be JSON array or plain text."""
    if not value:
        return []

    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return parsed
    except (json.JSONDecodeError, TypeError):
        # Not JSON, treat as plain text
        if value.strip():
            return [value.strip()]

    return []
