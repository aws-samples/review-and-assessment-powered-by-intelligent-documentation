# プロンプト改善提案

## 改善の方針

Claude 4 ベストプラクティス（https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices）に基づき、以下の方針で改善します:

1. **XML タグで構造化**: 重要なセクションを XML タグで明示
2. **肯定形の指示に変更**: "Do not"を削除し、"Do"で指示
3. **動的ツールセクション生成**: ツール設定に基づいてプロンプトを動的生成
4. **簡潔化**: 冗長な例示を削除
5. **並列実行の最適化**: 複数ツールの同時実行を促進
6. **一貫した JSON 制御**: マーカーの統一使用

## 現在のツール構成

実装済み:

- **Code Interpreter**: 計算・データ分析
- **Knowledge Base**: 規制・標準の検索
- **MCP**: 将来実装予定（任意のツール追加可能）

注意: インターネットアクセスは想定されていない

---

## 動的ツールセクション生成

ツール設定に基づいてプロンプトを動的に生成する関数を追加:

```python
def _build_tool_usage_section(
    tool_config: Optional[ToolConfiguration],
    language_name: str,
) -> str:
    """Build tool usage section dynamically based on configuration"""
    if not tool_config:
        return ""

    tool_descriptions = []
    use_cases = []

    # Code Interpreter
    if tool_config.get("codeInterpreter", False):
        tool_descriptions.append(
            "- **code_interpreter**: Perform calculations, data analysis, or process structured data"
        )
        use_cases.append("- Perform calculations or data analysis → Use code_interpreter")

    # Knowledge Base
    kb_config = tool_config.get("knowledgeBase")
    if kb_config:
        tool_descriptions.append(
            "- **knowledge_base_query**: Search knowledge bases for regulations, standards, or reference information"
        )
        use_cases.append("- Verify compliance with regulations/standards → Use knowledge_base_query")

    # MCP (future)
    mcp_config = tool_config.get("mcpConfig")
    if mcp_config:
        tool_descriptions.append(
            "- **MCP tools**: Additional specialized tools configured for this review"
        )
        use_cases.append("- Access external data sources → Use MCP tools")

    if not tool_descriptions:
        return ""

    tools_list = "\n".join(tool_descriptions)
    use_cases_list = "\n".join(use_cases)

    return f"""
<tool_usage>
<default_to_action>
Use available tools proactively to verify information:

{tools_list}

When to use tools:
{use_cases_list}
- Confidence below 0.80 → Use tools to increase confidence
</default_to_action>

<use_parallel_tool_calls>
When calling multiple independent tools, execute them in parallel. Only call tools sequentially when later calls depend on earlier results.
</use_parallel_tool_calls>
</tool_usage>
"""
```

**メリット**:

- ツール設定なし → Tool Usage セクション自体が表示されない
- Code Interpreter のみ → Code Interpreter の説明のみ
- KB + Code Interpreter → 両方の説明
- MCP 対応準備完了 → `mcpConfig`があれば自動追加

---

## 改善版プロンプト: PDF 文書審査（Legacy 版）

```python
def _get_document_review_prompt_legacy(
    language_name: str,
    check_name: str,
    check_description: str,
    tool_config: Optional[ToolConfiguration] = None,
) -> str:
    """Improved PDF document review prompt with dynamic tool section"""

    json_schema = f"""{{
  "result": "pass" | "fail",
  "confidence": <number between 0 and 1>,
  "explanation": "<detailed reasoning in {language_name}>",
  "shortExplanation": "<max 80 chars in {language_name}>",
  "extractedText": "<relevant excerpt in {language_name}>",
  "pageNumber": <integer starting from 1>
}}"""

    tool_section = _build_tool_usage_section(tool_config, language_name)

    return f"""You are an expert document reviewer. Review the attached documents against this check item:

<check_item>
**Name**: {check_name}
**Description**: {check_description}
</check_item>

<document_access>
Use the file_read tool to open and inspect each attached file.
</document_access>
{tool_section}
<output_requirements>
Generate your entire response in {language_name}. Output only the JSON below, enclosed in markers:

<<JSON_START>>
{json_schema}
<<JSON_END>>

Confidence guidelines:
- 0.90-1.00: Clear evidence, obvious compliance/non-compliance
- 0.70-0.89: Relevant evidence with some uncertainty
- 0.50-0.69: Ambiguous evidence, significant uncertainty

Your response must be valid JSON within the markers. All field values must be in {language_name}.
</output_requirements>
""".strip()
```

**主な変更点と理由**:

1. ✅ **XML タグで構造化**

   - 追加: `<check_item>`, `<document_access>`, `<tool_usage>`, `<output_requirements>`
   - 理由: Claude 4.5 は XML タグで構造化された指示を好む
   - 効果: セクションの明確化、指示の理解向上

2. ✅ **動的ツールセクション生成**

   - 追加: `tool_config`パラメータと`_build_tool_usage_section()`関数
   - 理由: ツール設定に基づいて必要な指示のみを含める
   - 効果: 不要な情報を排除、プロンプトの簡潔性向上

3. ✅ **`<default_to_action>`タグ（条件付き）**

   - 理由: ツールがある場合のみ積極的使用を促す
   - 効果: ツールなし時は不要な指示を避ける

4. ✅ **`<use_parallel_tool_calls>`タグ（条件付き）**

   - 理由: Claude 4.5 の並列実行能力を最大限活用
   - 効果: 複数の検証を同時実行し、処理速度向上

5. ✅ **否定形の削除**

   - 変更前: "Do **not** output anything outside the JSON"
   - 変更後: "Output only the JSON below"
   - 理由: ベストプラクティス「Tell Claude what to do instead of what not to do」

6. ✅ **冗長な例示の削除**

   - 変更前: 長い例示セクション（High-confidence pass, Medium-confidence fail）
   - 変更後: 簡潔な信頼度ガイドラインのみ
   - 理由: Claude 4.5 は簡潔な指示を好む

7. ✅ **マーカーの一貫使用**

   - すべてのプロンプトで`<<JSON_START>>`/`<<JSON_END>>`を使用
   - 理由: JSON 抽出の信頼性向上

8. ✅ **実装との整合性**
   - インターネット関連の記述を削除（MCP 未実装のため）
   - 実装済みツール（Code Interpreter, Knowledge Base）のみ言及
   - 理由: 実装されていない機能への言及を避ける

---

## 改善版プロンプト: PDF 文書審査（Citation 版）

```python
def _get_document_review_prompt_with_citations(
    language_name: str,
    check_name: str,
    check_description: str,
    tool_config: Optional[ToolConfiguration] = None,
) -> str:
    """Improved PDF document review prompt with citations and dynamic tool section"""

    json_schema = f"""{{
  "result": "pass" | "fail",
  "confidence": <number between 0 and 1>,
  "explanation": "<detailed reasoning in {language_name}>",
  "shortExplanation": "<max 80 chars in {language_name}>",
  "pageNumber": <integer starting from 1>
}}"""

    tool_section = _build_tool_usage_section(tool_config, language_name)

    return f"""You are an expert document reviewer. Review the attached documents against this check item:

<check_item>
**Name**: {check_name}
**Description**: {check_description}
</check_item>

<document_access>
Documents are attached with citation support enabled. Reference specific passages naturally in your explanation.
</document_access>
{tool_section}
<output_requirements>
Generate your entire response in {language_name}. Output only the JSON below, enclosed in markers:

<<JSON_START>>
{json_schema}
<<JSON_END>>

Confidence guidelines:
- 0.90-1.00: Clear evidence, obvious compliance/non-compliance
- 0.70-0.89: Relevant evidence with some uncertainty
- 0.50-0.69: Ambiguous evidence, significant uncertainty

Your response must be valid JSON within the markers. All field values must be in {language_name}. Citations will be automatically extracted from your natural language explanation.
</output_requirements>
""".strip()
```

**主な変更点**:

- Legacy 版と同じ改善を適用
- Citation 特有の説明を簡潔化
- `extractedText`フィールドを削除（自動抽出されるため）

---

## 改善版プロンプト: 画像審査

```python
def get_image_review_prompt(
    language_name: str,
    check_name: str,
    check_description: str,
    model_id: str,
    tool_config: Optional[ToolConfiguration] = None,
) -> str:
    """Improved image review prompt with dynamic tool section"""

    is_nova = "amazon.nova" in model_id

    bbox_field = (
        f""",
  "boundingBoxes": [
      {{
        "imageIndex": <image index>,
        "label": "<label in {language_name}>",
        "coordinates": [<x1>, <y1>, <x2>, <y2>]
      }}
  ]"""
        if is_nova
        else ""
    )

    bbox_instruction = (
        "\n\nFor detected objects, provide bounding box coordinates in [x1, y1, x2, y2] format (0-1000 scale)."
        if is_nova
        else ""
    )

    json_schema = f"""{{
  "result": "pass" | "fail",
  "confidence": <number between 0 and 1>,
  "explanation": "<detailed reasoning in {language_name}>",
  "shortExplanation": "<max 80 chars in {language_name}>",
  "usedImageIndexes": [<indexes of images actually referenced>]{bbox_field}
}}"""

    tool_section = _build_tool_usage_section(tool_config, language_name)

    return f"""You are an expert image reviewer (Model: {model_id}). Review the attached images against this check item:

<check_item>
**Name**: {check_name}
**Description**: {check_description}
</check_item>

<image_access>
Use the image_reader tool to analyze attached images. Reference images by zero-based index (0, 1, 2...).{bbox_instruction}
</image_access>
{tool_section}
<output_requirements>
Generate your entire response in {language_name}. Output only the JSON below, enclosed in markers:

<<JSON_START>>
{json_schema}
<<JSON_END>>

Important:
- Include in `usedImageIndexes` only images you explicitly referenced when making your judgment
- Exclude images that contained no relevant information
- Empty array means no images were used

Confidence guidelines:
- 0.90-1.00: Clear visual evidence, obvious compliance/non-compliance
- 0.70-0.89: Relevant visual evidence with some uncertainty
- 0.50-0.69: Ambiguous visual evidence, significant uncertainty

Your response must be valid JSON within the markers. All field values must be in {language_name}.
</output_requirements>
""".strip()
```

**主な変更点**:

- Legacy 版・Citation 版と同じ改善を適用
- XML タグで構造化（`<check_item>`, `<image_access>`, `<tool_usage>`, `<output_requirements>`）
- 動的ツールセクション生成
- 否定形の削除
- 冗長な説明の削除
- `tool_config`パラメータの追加

---

## システムプロンプトの改善

現在のシステムプロンプトも改善できます:

```python
# 変更前
system_prompt = f"You are an expert document reviewer. Analyze the provided files and evaluate the check item. All responses must be in {language_name}."

# 変更後
system_prompt = f"""You are an expert document reviewer specializing in compliance verification.

Your task: Analyze provided files against check items and deliver structured assessments in {language_name}.

Key behaviors:
- Use tools proactively to verify information
- Execute independent tool calls in parallel
- Provide grounded, evidence-based judgments
- Generate all output in {language_name}"""
```

**理由**:

- より具体的な役割定義
- 期待される動作を明示
- 簡潔で直接的

---

## 期待される効果

1. **構造化による理解向上**: XML タグによりセクションの役割が明確化
2. **動的プロンプト生成**: ツール設定に応じた最適なプロンプト
3. **ツール使用率の向上**: 明示的な`<default_to_action>`により、積極的なツール活用
4. **処理速度の向上**: 並列実行により複数検証の同時実行
5. **JSON 抽出の安定性向上**: 一貫したマーカー使用
6. **信頼度の向上**: より積極的な検証により高信頼度の判断
7. **コードの保守性向上**: プロンプトの簡潔化により理解しやすく
8. **実装との整合性**: 実装されていない機能への言及を排除

---

## 参考: Claude 4 ベストプラクティスの適用箇所

| ベストプラクティス                  | 適用箇所                    | 効果                    |
| ----------------------------------- | --------------------------- | ----------------------- |
| Be explicit with instructions       | XML タグによる構造化        | セクションの役割明確化  |
| Be explicit with instructions       | 動的ツールセクション生成    | 必要な指示のみ含める    |
| Optimize parallel tool calling      | `<use_parallel_tool_calls>` | 処理速度向上            |
| Tell what to do, not what not to do | 否定形の削除                | 指示の明確化            |
| Be vigilant with examples           | 冗長な例示の削除            | 本質的な指示に集中      |
| Control format of responses         | `<<JSON_START>>`マーカー    | JSON 抽出の安定性       |
| Communication style                 | 簡潔で直接的な表現          | Claude 4.5 の特性に適合 |
| Tool usage patterns                 | `<default_to_action>`       | ツール使用の明確化      |

参考 URL: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices
