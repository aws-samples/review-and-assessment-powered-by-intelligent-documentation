# プロンプト改善提案

## 改善の方針

Claude 4ベストプラクティス（https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices）に基づき、以下の方針で改善します:

1. **XMLタグで構造化**: 重要なセクションをXMLタグで明示
2. **肯定形の指示に変更**: "Do not"を削除し、"Do"で指示
3. **動的ツールセクション生成**: ツール設定に基づいてプロンプトを動的生成
4. **簡潔化**: 冗長な例示を削除
5. **並列実行の最適化**: 複数ツールの同時実行を促進
6. **一貫したJSON制御**: マーカーの統一使用

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
- ツール設定なし → Tool Usageセクション自体が表示されない
- Code Interpreterのみ → Code Interpreterの説明のみ
- KB + Code Interpreter → 両方の説明
- MCP対応準備完了 → `mcpConfig`があれば自動追加

---

## 改善版プロンプト: PDF文書審査（Legacy版）

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

1. ✅ **XMLタグで構造化**
   - 追加: `<check_item>`, `<document_access>`, `<tool_usage>`, `<output_requirements>`
   - 理由: Claude 4.5はXMLタグで構造化された指示を好む
   - 効果: セクションの明確化、指示の理解向上

2. ✅ **動的ツールセクション生成**
   - 追加: `tool_config`パラメータと`_build_tool_usage_section()`関数
   - 理由: ツール設定に基づいて必要な指示のみを含める
   - 効果: 不要な情報を排除、プロンプトの簡潔性向上

3. ✅ **`<default_to_action>`タグ（条件付き）**
   - 理由: ツールがある場合のみ積極的使用を促す
   - 効果: ツールなし時は不要な指示を避ける

4. ✅ **`<use_parallel_tool_calls>`タグ（条件付き）**
   - 理由: Claude 4.5の並列実行能力を最大限活用
   - 効果: 複数の検証を同時実行し、処理速度向上

5. ✅ **否定形の削除**
   - 変更前: "Do **not** output anything outside the JSON"
   - 変更後: "Output only the JSON below"
   - 理由: ベストプラクティス「Tell Claude what to do instead of what not to do」

6. ✅ **冗長な例示の削除**
   - 変更前: 長い例示セクション（High-confidence pass, Medium-confidence fail）
   - 変更後: 簡潔な信頼度ガイドラインのみ
   - 理由: Claude 4.5は簡潔な指示を好む

7. ✅ **マーカーの一貫使用**
   - すべてのプロンプトで`<<JSON_START>>`/`<<JSON_END>>`を使用
   - 理由: JSON抽出の信頼性向上

8. ✅ **実装との整合性**
   - インターネット関連の記述を削除（MCP未実装のため）
   - 実装済みツール（Code Interpreter, Knowledge Base）のみ言及
   - 理由: 実装されていない機能への言及を避ける

---

## 改善版プロンプト: PDF文書審査（Citation版）

```python
def _get_document_review_prompt_with_citations(
    language_name: str,
    check_name: str,
    check_description: str,
) -> str:
    """Improved PDF document review prompt with citation support"""

    json_schema = f"""{{
  "result": "pass" | "fail",
  "confidence": <number between 0 and 1>,
  "explanation": "<detailed reasoning in {language_name}>",
  "shortExplanation": "<max 80 chars in {language_name}>",
  "pageNumber": <integer starting from 1>
}}"""

    return f"""You are an expert document reviewer. Review the attached documents against this check item:

**Check Item**: {check_name}
**Description**: {check_description}

## Document Access
Documents are attached with citation support enabled. Reference specific passages naturally in your explanation.

## Tool Usage - Default to Action
<default_to_action>
By default, use external tools proactively to verify information. When you need factual verification, compliance checks, or supplementary evidence, immediately call the appropriate tool rather than making assumptions.

Use tools in these situations:
- Verify factual information (addresses, names, figures, dates) → Use search/scrape MCP tools
- Check compliance with regulations/standards → Use knowledge_base_query
- Resolve ambiguous or contradictory content → Use MCP tools for clarification
- Confirm technical definitions or regulations → Use authoritative reference tools
- Verify organization/person legitimacy → Use public registry tools
- Check recent events/regulations (within 2 years) → Use current information tools
- Confidence below 0.80 → Use one or more tools to increase confidence
</default_to_action>

<use_parallel_tool_calls>
When calling multiple independent tools, execute them in parallel. For example, if verifying three different facts, make three tool calls simultaneously rather than sequentially. Only call tools sequentially when later calls depend on earlier results.
</use_parallel_tool_calls>

## Output Requirements
Generate your entire response in {language_name}. Output only the JSON below, enclosed in markers:

<<JSON_START>>
{json_schema}
<<JSON_END>>

**Confidence Guidelines**:
- 0.90-1.00: Clear evidence, obvious compliance/non-compliance
- 0.70-0.89: Relevant evidence with some uncertainty
- 0.50-0.69: Ambiguous evidence, significant uncertainty

Your response must be valid JSON within the markers. All field values must be in {language_name}. Citations will be automatically extracted from your natural language explanation.
""".strip()
```

**主な変更点**:
- Legacy版と同じ改善を適用
- Citation特有の説明を簡潔化
- `extractedText`フィールドを削除（自動抽出されるため）

---

## 改善版プロンプト: 画像審査

```python
def get_image_review_prompt(
    language_name: str,
    check_name: str,
    check_description: str,
    model_id: str,
) -> str:
    """Improved image review prompt with conditional bounding box support"""
    
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

    return f"""You are an expert image reviewer (Model: {model_id}). Review the attached images against this check item:

**Check Item**: {check_name}
**Description**: {check_description}

## Image Access
Use the image_reader tool to analyze attached images. Reference images by zero-based index (0, 1, 2...).{bbox_instruction}

## Tool Usage - Default to Action
<default_to_action>
By default, use external tools proactively to verify information. When you need factual verification, compliance checks, or supplementary evidence, immediately call the appropriate tool rather than making assumptions.

Use tools in these situations:
- Verify factual information visible in images → Use search/scrape MCP tools
- Check compliance with regulations/standards → Use knowledge_base_query
- Resolve unclear or ambiguous visual content → Use MCP tools for clarification
- Confirm technical definitions or regulations → Use authoritative reference tools
- Verify organization/person legitimacy shown in images → Use public registry tools
- Confidence below 0.80 → Use one or more tools to increase confidence
</default_to_action>

<use_parallel_tool_calls>
When calling multiple independent tools, execute them in parallel. For example, if verifying three different facts, make three tool calls simultaneously rather than sequentially. Only call tools sequentially when later calls depend on earlier results.
</use_parallel_tool_calls>

## Output Requirements
Generate your entire response in {language_name}. Output only the JSON below, enclosed in markers:

<<JSON_START>>
{json_schema}
<<JSON_END>>

**Important**: 
- Include in `usedImageIndexes` only images you explicitly referenced when making your judgment
- Exclude images that contained no relevant information
- Empty array means no images were used

**Confidence Guidelines**:
- 0.90-1.00: Clear visual evidence, obvious compliance/non-compliance
- 0.70-0.89: Relevant visual evidence with some uncertainty
- 0.50-0.69: Ambiguous visual evidence, significant uncertainty

Your response must be valid JSON within the markers. All field values must be in {language_name}.
""".strip()
```

**主な変更点**:
1. ✅ 条件付きbounding box指示の簡潔化
2. ✅ `<default_to_action>`と`<use_parallel_tool_calls>`の追加
3. ✅ 否定形の削除（"Do NOT mention" → "Include only"）
4. ✅ 冗長な説明の削除

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

## 実装時の注意点

1. **段階的な導入**
   - まずLegacy版で改善効果を測定
   - 問題なければCitation版、Image版に展開

2. **A/Bテスト推奨**
   - 旧プロンプトと新プロンプトで結果を比較
   - 信頼度スコア、ツール使用率、処理時間を測定

3. **モニタリング**
   - ツール使用パターンの変化を監視
   - 並列実行の効果を測定
   - JSON抽出の成功率を追跡

4. **言語別の調整**
   - 日本語以外の言語でもテスト
   - 必要に応じて言語固有の調整

---

## 期待される効果

1. **ツール使用率の向上**: 明示的な`<default_to_action>`により、積極的なツール活用
2. **処理速度の向上**: 並列実行により複数検証の同時実行
3. **JSON抽出の安定性向上**: 一貫したマーカー使用
4. **信頼度の向上**: より積極的な検証により高信頼度の判断
5. **コードの保守性向上**: プロンプトの簡潔化により理解しやすく

---

## 参考: Claude 4ベストプラクティスの適用箇所

| ベストプラクティス | 適用箇所 | 効果 |
|---|---|---|
| Be explicit with instructions | `<default_to_action>` | ツール使用の明確化 |
| Optimize parallel tool calling | `<use_parallel_tool_calls>` | 処理速度向上 |
| Tell what to do, not what not to do | 否定形の削除 | 指示の明確化 |
| Be vigilant with examples | 冗長な例示の削除 | 本質的な指示に集中 |
| Control format of responses | `<<JSON_START>>`マーカー | JSON抽出の安定性 |
| Communication style | 簡潔で直接的な表現 | Claude 4.5の特性に適合 |
