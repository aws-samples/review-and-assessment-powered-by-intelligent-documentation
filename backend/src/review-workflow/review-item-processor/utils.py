"""
Utility functions for the review item processor
"""

import json
from typing import Any, Dict, List, Optional


def get_language_name(language_code: str) -> str:
    """
    Get the language name for a language code.

    Args:
        language_code: ISO 639-1 language code

    Returns:
        Language name
    """
    language_map = {
        "ja": "日本語",
        "en": "English",
        "zh": "中文",
        "ko": "한국어",
        "es": "Español",
        "fr": "Français",
        "de": "Deutsch",
        "it": "Italiano",
        "pt": "Português",
        "ru": "Русский",
        "ar": "العربية",
    }

    return language_map.get(language_code, "English")


def format_prompt(check_item: Dict[str, Any], language_name: str) -> str:
    """
    Format a prompt for the review item processor.

    Args:
        check_item: Check item to be used in the prompt
        language_name: Language name to be used in the prompt

    Returns:
        Formatted prompt
    """
    check_name = check_item.get("name", "Unknown check")
    check_description = check_item.get("description", "")

    prompt = f"""
あなたは文書審査の専門家です。提供された文書に対して、チェック項目に基づいて審査を行ってください。
文書を詳細に分析し、チェック項目の条件を満たしているかどうかを判断してください。

## チェック項目
名前: {check_name}
説明: {check_description}

## 審査のポイント
1. 文書内にチェック項目に関連する情報があるか確認する
2. その情報が要件を満たしているか判断する
3. 判断が難しい場合は、外部の情報源を使って確認する（例：住所の存在確認、企業の実在確認など）

## インターネット検索と外部リソース
インターネットで情報を確認するために、firecrawl_searchやfirecrawl_scrapeなどのツールが利用できます。
例えば、住所の実在確認や会社の存在確認など、外部での検証が必要な場合に使用してください。

## 出力形式
審査結果を以下のJSON形式で出力してください：
```json
{{
  "result": "pass" または "fail",
  "confidence": 0から1の間の数値（信頼度）,
  "explanation": "判断の詳細な説明",
  "shortExplanation": "簡潔な説明（100文字以内）",
  "extractedText": "根拠となる文書からの抜粋",
  "pageNumber": 文書内のページ番号（わかる場合）,
  "verificationDetails": {{
    "externalSourcesUsed": true または false,
    "sourcesDetails": "使用した外部情報源の詳細"
  }}
}}
```
出力は{language_name}で行ってください。
"""
    return prompt


def parse_json_result(text: str) -> Dict[str, Any]:
    """
    Parse JSON from text.

    Args:
        text: Text containing JSON

    Returns:
        Parsed JSON
    """
    try:
        # Try to find JSON pattern
        import re

        json_match = re.search(r"(\{[\s\S]*\})", text)
        if json_match:
            return json.loads(json_match.group(1))

        # If no JSON found, try to extract structured data
        lines = text.strip().split("\n")
        result = {}

        for line in lines:
            if ":" in line:
                key, value = line.split(":", 1)
                result[key.strip()] = value.strip()

        return result
    except Exception as e:
        print(f"Error parsing JSON: {e}")
        return {
            "result": "fail",
            "confidence": 0.5,
            "explanation": "Failed to parse result.",
            "shortExplanation": "Processing error",
        }


def ensure_result_fields(result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ensure all required fields are present in the result.

    Args:
        result: Review result

    Returns:
        Review result with all required fields
    """
    # Ensure all required fields exist
    if "result" not in result:
        result["result"] = "fail"
    if "confidence" not in result:
        result["confidence"] = 0.5
    if "explanation" not in result:
        result["explanation"] = "No explanation provided"
    if "shortExplanation" not in result:
        result["shortExplanation"] = "No short explanation provided"
    if "extractedText" not in result:
        result["extractedText"] = ""
    if "pageNumber" not in result:
        result["pageNumber"] = 1
    if "verificationDetails" not in result:
        result["verificationDetails"] = {
            "externalSourcesUsed": False,
            "sourcesDetails": "",
        }

    return result


def check_environment_variables() -> List[str]:
    """
    Check required environment variables.

    Returns:
        List of missing environment variables
    """
    required_vars = [
        "DOCUMENT_BUCKET",
        "BEDROCK_REGION",
    ]

    import os

    missing_vars = [var for var in required_vars if not os.environ.get(var)]

    return missing_vars
