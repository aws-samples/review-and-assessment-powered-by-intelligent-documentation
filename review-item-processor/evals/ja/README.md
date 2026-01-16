# RAPID レビューエージェント評価

[English](../README.md) | 日本語

レビューエージェントの精度、再現率、信頼度キャリブレーションをテストするための迅速な評価フレームワークです。

---

## クイックスタート

依存関係をインストール:

```bash
cd review-item-processor
uv sync --extra evals
```

事前構築されたデモを実行して動作を確認:

```bash
uv run python evals/scripts/run_eval.py --suite ja/examples/floor_plan_hitl_suite.json
```

以下のようなメトリクスが表示されます:

- Accuracy: 100% (3/3 正解)
- Recall: 100% ⭐ (すべての問題を検出)
- Critical Errors: 0 (HITL 対応として安全)

**何が起きたか?** 3 つの異なるプロンプトパターンで AI エージェントをテストしました(約 1-2 分)。これらのメトリクスの意味については、以下の「コアコンセプト」セクションを参照してください。

**さらに詳しく?** 詳細なウォークスルーについては、以下の「包括的な例」セクションを参照してください。

---

## コアコンセプト

### 評価フレームワークについて

この評価システムは、AI エージェントをテストするためのオープンソースフレームワークである[strands-evals](https://github.com/strandslabs/strands-evals)を使用しています。複数の評価タイプを含みます:**精度チェック**(完全一致)、**信頼度キャリブレーション**(信頼度スコアが実際の精度とどの程度一致するか)、**LLM-as-judge**(別の AI が出力品質と説明を評価)、**忠実性検証**(回答がソースドキュメントに基づいているかチェック)。テスト実行後、すべての評価者からの結果が表示されます。

### 評価とは?

評価は、AI エージェントが正しい判断を下すかどうかをテストします。すべてのドキュメントを手動でチェックする代わりに:

1. 既知の正解(正解ラベル)を持つテストケースを作成
2. それらのテストケースでエージェントを実行
3. エージェントの回答を正解ラベルと比較
4. パフォーマンスを測定するメトリクスを計算

### なぜ評価するのか?

本番環境(特に安全性/コンプライアンス)に AI エージェントをデプロイする前に、以下を確認する必要があります:

- すべての重要な問題を検出する(高い再現率)
- 誤警報が多すぎない(良好な適合率)
- 不確実な場合にそれを認識する(良好なキャリブレーション)

### 2 種類のメトリクス

**1. 精度メトリクス - エージェントは正しいか?**

- **Recall (再現率)** ⭐ (最重要): エージェントが検出した実際の問題の割合

  - 例: 10 件の違反があり、エージェントが 9 件を発見した場合、再現率 = 90%
  - 安全性/コンプライアンスでは、>95%を目指す

- **Precision (適合率)**: エージェントのフラグのうち実際の問題である割合

  - 例: エージェントが 10 項目にフラグを立てたが、実際の問題は 8 件の場合、適合率 = 80%
  - 低い適合率 = より多くの不要な人間レビュー(許容可能なトレードオフ)

- **Accuracy (精度)**: 全体的な正確性(正しい予測 / 総予測数)

**2. キャリブレーションメトリクス - エージェントは自分が正しいときを認識しているか?**

- **Confidence (信頼度)**: エージェントの自己評価スコア(0.0 ～ 1.0)

  - 0.9+ = 非常に確信がある
  - 0.5-0.7 = 不確実
  - <0.5 = 非常に不確実

- **ECE (Expected Calibration Error / 期待キャリブレーション誤差)**: 信頼度と実際の精度の一致度

  - <0.10 = よくキャリブレーションされている
  - > 0.20 = 信頼度スコアを信頼できない

- **Critical Errors (FN@HC / 重大エラー)**: 高信頼度での偽陰性
  - これが最も危険 - エージェントが確信を持って違反を見逃す
  - 本番 HITL システムでは 0 でなければならない

---

## エージェントプロンプト評価

### 対象ユーザー

このevalフレームワークは主に**技術者向け**に設計されています。

#### 主要ユーザー: 技術者 (ML Engineer, Prompt Engineer, System Developer)

**役割**: agent.pyのプロンプトをチューニングして本番環境対応のエージェントをリリースする

**目的**: 「筋のいいエージェント」を作成する

**ワークフロー**:
1. agent.pyのシステムプロンプトを設計 (役割定義、出力形式、信頼度ガイドライン、クリティカルルール)
2. evalを実行してプロンプトバリエーションをテスト
3. メトリクスを分析 (recall, precision, ECE, critical errors)
4. 本番基準を満たすまでプロンプトを改善
5. エージェントをリリース

#### 副次的ユーザー: 非技術者 (Domain Expert, Compliance Officer, Safety Inspector)

**役割**: リリース済みのエージェントを使用して日常業務でドキュメントをレビューする

**目的**: 効率的なドキュメントレビュー

**ワークフロー**:
1. リリース済みエージェントを使用 (agent.pyは既にチューニング済み)
2. 自分のニーズに合わせてcheck_descriptionを記述
3. オプション: 小規模evalで自分のプロンプトを検証
4. 本番環境でエージェントを使用

**注**: 非技術者の方は、多くの場合evalを実行する必要はありません。技術チームがチューニングしたエージェントをそのまま使用してください。

### 何を評価しているのか?

この評価フレームワークは**agent.pyのプロンプト品質**を評価します。具体的には:

#### agent.pyで定義されているプロンプト関数

`agent.py`には複数のプロンプト関数が含まれています:

1. **Document review (with citations)**: `_get_document_review_prompt_with_citations()`
   - PDFドキュメントレビュー用
   - citationsフィールド (引用配列) を含む

2. **Image review**: `get_image_review_prompt()`
   - 画像レビュー用
   - usedImageIndexesとboundingBoxesをサポート

#### 各プロンプトに含まれる要素

すべてのプロンプトには以下の共通要素が含まれています:

- **役割定義 (Role)**:
  - Document: "You are an expert document reviewer"
  - Image: "You are an AI assistant who reviews images"

- **出力形式 (Output Format)**:
  - JSON schema with required fields
  - Language specification

- **信頼度ガイドライン (Confidence Guidelines)**:
  - 0.90-1.00: 明確な証拠あり、明らかな適合/非適合
  - 0.70-0.89: 関連証拠ありだが一部不確実
  - 0.50-0.69: 曖昧な証拠、大きな不確実性
  - 0.30-0.49: 判断に不十分な証拠

- **クリティカルルール (Critical Rules)**:
  - `BASE_JUDGMENT_ON_DOCUMENTS_ONLY`: 提供されたドキュメントのみに基づく判断
  - `INSUFFICIENT_INFORMATION_HANDLING`: 情報不足時の処理方法

#### check_description (ユーザープロンプト)

テストケースで指定される、チェック項目の具体的な指示:

```json
{
  "check_name": "1階廊下の消火器設置確認",
  "check_description": "建物A(ページ1)の1階廊下にABC型消火器が2台以上設置され、有効期限内であることを確認"
}
```

---

## 包括的な例: floor_plan_hitl_suite 実行結果の詳細解説

この例では、3つのテストケースを使用した実際の評価実行とその結果を詳しく解説します。

### 評価の実行方法

#### 使用ファイル

- **テストスイート**: `ja/examples/floor_plan_hitl_suite.json` (3 テストケース)
- **ドキュメント**: `ja/examples/fixtures/floor_plan_safety_reports.pdf` (1 ページのみ使用: Building A)
- **正解ラベル**: テストスイート内の事前決定された合格/不合格ラベル

#### コマンド実行

```bash
cd review-item-processor
uv run python evals/scripts/run_eval.py \
  --suite ja/examples/floor_plan_hitl_suite.json \
  --experiment comprehensive
```

### 評価結果 (実測値)

```
✓ ja/examples/floor_plan_hitl_suite.jsonから3個のテストケースをロード
✓ 3つの評価者で実験を作成

🤖 エージェント評価を実行中...
  ケース1/3を処理中: TC001-high-confidence-pass...
  ケース2/3を処理中: TC002-high-confidence-fail...
  ケース3/3を処理中: TC004-evidence-absent...

✓ 評価完了!
結果を保存: results/results_TIMESTAMP.json

=============================================================
精度メトリクス
=============================================================
Accuracy:  100% (3/3 正解)
Recall:    100% ⭐ (すべての違反を検出)
Precision: 100% (誤検出なし)
F1 Score:  1.00

False Negatives: 0 (違反の見逃しなし - HITL安全!)
False Positives: 0 (誤検出なし)

=============================================================
信頼度キャリブレーション (HITL安全性)
=============================================================
ECE (キャリブレーション誤差):   0.233 (良好 - <0.30)
Over-Confidence Rate:           0.0%
Critical Errors (FN@HC):        0 (高信頼度の偽陰性なし)

=============================================================
EXPLANATION QUALITY (LLM-as-Judge)
=============================================================
Mean Score:         0.87/1.0
Min Score:          0.80
Max Score:          0.95
Low Quality Count:  0
```

### 結果の説明: テストケースとメトリクスの紐付け

このセクションでは、**特定のテストケースが各メトリクスにどう貢献したか**を説明します。

#### メトリクスサマリー

| メトリクス          | 値      | 意味                                               | これは良いか?                 |
| ------------------- | ------- | -------------------------------------------------- | ----------------------------- |
| **Accuracy**        | 100%    | エージェントは 3 のうち 3 つの予測を正しく行った    | ✓ 完璧 - すべて正確           |
| **Recall**          | 100% ⭐ | すべての実際の違反を検出(偽陰性 0)                 | ✓ 優秀 - 本番環境で安全       |
| **Precision**       | 100%    | すべての"fail"予測が実際の違反                     | ✓ 完璧 - 誤検出なし           |
| **F1 Score**        | 1.00    | 適合率と再現率のバランス指標                       | ✓ 完璧                        |
| **ECE**             | 0.233   | 信頼度スコアが精度とよく一致                       | ✓ 良好 - よくキャリブレーション済 |
| **Over-Confidence** | 0.0%    | 高信頼度予測で誤りなし                             | ✓ 完璧 - 過信なし             |
| **Critical Errors** | 0       | 高信頼度で違反を見逃したことがない                 | ✓ 完璧 - 危険なエラーなし     |

#### テストケース別の貢献

**TC001 (high-confidence-pass, 0.95 confidence):**
- ✅ 明確な証拠でpass → Accuracyに貢献
- ✅ 高信頼度で正しい → ECE (優秀なキャリブレーション) に貢献
- 内容: 1階廊下にABC型消火器2台以上、有効期限内
- PDFに明確な記載: "1階廊下: ABC型消火器 2台 - 設置済み、有効期限内"

**TC002 (high-confidence-fail, 0.95 confidence):**
- ✅ 明確な基準違反でfail → **100% Recallに貢献**
- ✅ 高信頼度で正しい → Precisionに貢献
- 内容: 非常灯バッテリーバックアップ120分以上（実際90分）
- PDFに明確な記載: "バッテリーバックアップ: 90分"
- 90 < 120 → 明確な基準違反 → 高confidence fail

**TC004 (evidence-absent, 0.40 confidence):**
- ✅ 証拠不在を正しくfail判定 → **100% Recallに決定的に貢献**
- ✅ 低信頼度 (0.40) で正しい判断 → INSUFFICIENT_INFORMATION_HANDLINGルール通り
- 内容: スプリンクラーシステムの設置確認
- PDFに記載なし → 証拠不在 → confidence 0.40 でfail

#### 重要な洞察

**✅ HITL システムとして完璧:**
- **100% Accuracy**: すべての予測が正確
- **100% Recall**: すべての実際の違反を検出 (TC002, TC004)
- **100% Precision**: 誤検出ゼロ
- **0 Critical Errors**: 高信頼度で違反を見逃したことがない
- **ECE 0.233**: 信頼度が実際の精度とよく一致

---

## カスタマイズ方法: 独自ドキュメントのテスト

以下の手順に従って、独自のドキュメントで評価を作成して実行します。

### ステップ 1: テストドキュメントの準備

PDF を fixtures ディレクトリにコピー:

```bash
cp your_document.pdf evals/my_tests/fixtures/
```

**サポートされる形式**: PDF(主要、引用サポートあり)、PNG、JPG

### ステップ 2: テストケース定義の作成

テンプレートをコピーして編集:

```bash
cp evals/my_tests/template.json evals/my_tests/my_suite.json
```

`my_tests/my_suite.json`を編集:

```json
{
  "name": "my-fire-safety-check",
  "input": {
    "document_paths": ["your_document.pdf"],
    "check_name": "消火器チェック",
    "check_description": "安全基準に従って消火器が設置され、適切に保守されているかを確認",
    "language_name": "日本語"
  },
  "expected_output": {
    "result": "pass"
  }
}
```

**必須フィールド**:

- `name`: このテストケースの一意の識別子
- `document_paths`: ドキュメントファイル名の配列(ファイル名のみ、フルパスではない)
- `check_name`: チェック内容の短い名前
- `check_description`: 要件の詳細な説明
- `language_name`: "English" または "日本語"
- `expected_output.result`: 正解ラベル - "pass" または "fail"

**オプションフィールド**:

- `tool_configuration`: 高度なユースケース用(References セクション参照)

### ステップ 3: 正解ラベルの決定

**あなた自身がドキュメントを読んで正しい答えを決定する必要があります**:

1. ドキュメントを注意深く読む
2. `check_description`の要件と照らし合わせてチェック
3. 決定: "pass"(準拠) または "fail"(非準拠)

**例**:

- ドキュメントに消火器が設置されている → `"result": "pass"`
- ドキュメントに必要な安全機器が欠落 → `"result": "fail"`
- 部分的コンプライアンス → `"result": "fail"` (人間レビュー用にフラグ)

**重要**: 正解ラベルは、答えがどうあるべきかであり、エージェントが何と言うかの予想ではありません。

### ステップ 4: 評価の実行と反復改善

**4.1 初回評価を実行:**

```bash
cd review-item-processor
uv run python evals/scripts/run_eval.py --suite my_tests/my_suite.json
```

**4.2 結果を解釈し、主要メトリクスに注目:**

- **Recall**: エージェントはすべての違反を検出したか?
  - 目標: 安全性/コンプライアンスで>95%
  - 低い場合: 偽陰性をレビューし、check_description を改善

- **Precision**: フラグのうち何件が実際の問題か?
  - 目標: >80%(いくつかの偽陽性は許容可能)
  - 低い場合: check_description が曖昧すぎないかチェック

- **Critical Errors**: 高信頼度の偽陰性はあるか?
  - 目標: 0(本番環境では必ずゼロ)
  - > 0 の場合: 重大 - すぐにこれらのケースをレビュー

**4.3 必要に応じてテストケースを追加し、反復:**

結果に基づいてテストスイートを拡張します。JSON を配列にして複数ケースを追加:

```json
[
  {
    "name": "test-case-1",
    "input": {
      "document_paths": ["doc1.pdf"],
      "check_name": "消火器チェック",
      "check_description": "...",
      "language_name": "日本語"
    },
    "expected_output": { "result": "pass" }
  },
  {
    "name": "test-case-2",
    "input": {
      "document_paths": ["doc2.pdf"],
      "check_name": "非常口チェック",
      "check_description": "...",
      "language_name": "日本語"
    },
    "expected_output": { "result": "fail" }
  }
]
```

**推奨**: 有意義なメトリクスを得るには、5-10 のテストケースから始めてください。新しいケースを追加したら、評価を再実行して改善を確認します。

### ステップ 5: 結果の保存とレビュー

結果は自動的に`results/results_TIMESTAMP.json`に保存されます。

ケースごとの詳細な結果を見るには、`--verbose`で実行:

```bash
uv run python evals/scripts/run_eval.py --suite my_tests/my_suite.json --verbose
```

---

## リファレンス

### メトリクス定義

#### 精度メトリクス

- **Recall (再現率)** ⭐ **主要メトリクス**

  - エージェントが検出した実際の問題の割合
  - 計算式: True Positives / (True Positives + False Negatives)
  - **なぜ重要か**: 安全性/コンプライアンスでは、実際の問題を見逃すこと(偽陰性)は、非問題にフラグを立てること(偽陽性)よりもはるかに悪い。偽陽性は人間レビューに回されるが、偽陰性は完全に見逃される可能性がある。
  - 目標: 安全性/コンプライアンスアプリケーションで>95%

- **Precision (適合率)**

  - エージェントのフラグのうち実際の問題である割合
  - 計算式: True Positives / (True Positives + False Positives)
  - 低い適合率 = より多くの不要な人間レビュー(高い再現率のための許容可能なトレードオフ)
  - 目標: >80%

- **Accuracy (精度)**

  - 全体的な正確性
  - 計算式: (True Positives + True Negatives) / 総ケース数
  - 目標: >90%

- **F1 Score (F1 スコア)**
  - 適合率と再現率の調和平均
  - 計算式: 2 × (Precision × Recall) / (Precision + Recall)
  - 適合率と再現率の両方が重要な場合のバランス指標

#### キャリブレーションメトリクス (HITL 安全性)

- **ECE (Expected Calibration Error / 期待キャリブレーション誤差)**

  - 信頼度スコアが実際の精度とどの程度一致するかを測定
  - **計算式**: `ECE = (1/M) × Σ|accuracy(Bm) - confidence(Bm)|`
    - M = 信頼度ビンの数(通常 10)
    - Bm = ビン m 内の予測
    - accuracy(Bm) = ビン内の実際の精度
    - confidence(Bm) = ビン内の平均信頼度
  - **例**:
    ```
    ビン [0.8-0.9]: 5つの予測、4つ正解
    accuracy(B) = 4/5 = 0.80
    confidence(B) = 0.85 (平均)
    |0.80 - 0.85| = 0.05 (ECEへの寄与)
    ```
  - 低いほど良い: <0.10 は良好、<0.05 は優秀
  - **なぜ重要か**: 高信頼度の予測が実際に正しい場合にのみ信頼したい。過信した誤った予測は本番 HITL システムで危険。

- **Brier Score (ブライアスコア)**

  - 全体的な予測品質メトリクス(精度とキャリブレーションを組み合わせ)
  - **計算式**: `Brier = (1/N) × Σ(confidence - truth)²`
    - N = 予測数
    - confidence = 予測確率
    - truth = 正解なら 1、誤りなら 0
  - **例**:

    ```
    予測: "pass"、信頼度0.9、実際にpass
    (0.9 - 1)² = 0.01 (小さなペナルティ - 良好!)

    予測: "fail"、信頼度0.8、実際にpass
    (0.8 - 0)² = 0.64 (高いペナルティ - 悪い!)
    ```

  - 低いほど良い: 0.0 = 完璧、1.0 = 最悪
  - 不正確な予測と不適切な信頼度キャリブレーションの両方にペナルティ

- **Over-Confidence Rate (過信率)**

  - 高信頼度予測(>0.85)のうち誤っている割合
  - **計算式**: `OCR = FP_high / Total_high`
    - FP_high = 信頼度>0.85 の誤った予測
    - Total_high = 信頼度>0.85 のすべての予測
  - **例**:
    ```
    6つの高信頼度予測(>0.85)
    1つ誤り = OCR = 1/6 = 16.7%
    ```
  - 0%に近いべき
  - 高い場合: エージェントは危険なほど過信している

- **Critical Errors (FN@HC / 重大エラー)**

  - 高信頼度(>0.85)での偽陰性
  - **定義**: 以下の条件を満たす予測の数:
    - 期待される結果: FAIL(違反が存在)
    - エージェントの結果: PASS(見逃した!)
    - エージェントの信頼度: > 0.85(誤った答えに非常に確信)
  - **例**:
    ```
    ドキュメントに防火規定違反あり(正解ラベル: FAIL)
    エージェントの判定: PASS、信頼度0.90
    → これは重大エラー(危険な見逃し!)
    ```
  - **最も危険なエラータイプ** - エージェントが確信を持って違反を見逃す
  - 本番 HITL システムでは 0 でなければならない

- **Safe Threshold (安全閾値)**
  - 自動承認に推奨される信頼度レベル
  - 偽陰性率を最小化しながら精度を最大化するように計算
  - この閾値を使用して、エージェントを信頼するか人間レビューに送るかを決定

#### 結果の解釈

| メトリクス      | 良好  | 警告  | アクション                                        |
| --------------- | ----- | ----- | ------------------------------------------------- |
| Recall          | >95%  | <90%  | ⚠️ check_description を改善、トレーニング例を追加 |
| Precision       | >80%  | <70%  | ⚠️ check_description が曖昧すぎる可能性           |
| ECE             | <0.10 | >0.20 | ⚠️ 信頼度スコアを信頼できない                     |
| Critical Errors | 0     | >0    | 🚨 重大 - すぐにレビュー                          |

### CLI オプションリファレンス

#### run_eval.py

コマンドラインから評価を実行:

```bash
uv run python evals/scripts/run_eval.py [OPTIONS]
```

**オプション:**

- `--suite <path>` - テストスイートを実行(テストケースの配列を含む JSON ファイル)

  - 例: `--suite my_tests/my_suite.json`

- `--case <path>` - 単一テストケースを実行(単一テストケースを含む JSON ファイル)

  - 例: `--case my_tests/single_case.json`

- `--experiment <type>` - 実験タイプを選択:

  - `accuracy` - 精度とキャリブレーションメトリクスのみ(高速)
  - `tool` - ツール使用効率メトリクスを追加
  - `comprehensive` - 説明品質を含むすべてのメトリクス(デフォルト)

- `--output <path>` - 結果を特定のファイルに保存

  - デフォルト: `results/results_TIMESTAMP.json`
  - 例: `--output my_results.json`

- `--verbose` - 各テストケースの詳細出力を表示
  - エージェントの出力、信頼度、説明を表示
  - 偽陰性/偽陽性のデバッグに便利

**例:**

```bash
# 包括的評価を実行(デフォルト)
uv run python evals/scripts/run_eval.py --suite my_tests/my_suite.json

# 詳細出力で実行
uv run python evals/scripts/run_eval.py --suite my_tests/my_suite.json --verbose

# 単一テストケースを実行
uv run python evals/scripts/run_eval.py --case my_tests/single_case.json

# 精度のみ実行(高速)
uv run python evals/scripts/run_eval.py --suite my_tests/my_suite.json --experiment accuracy
```

### 高度なトピック

#### ツール設定(外部ナレッジベース)

ほとんどの評価では外部ツールは不要です - PDF と check_description だけで十分です。ただし、外部参照(建築基準法、規格、規制)を必要とするチェックの場合、ナレッジベースツールを設定できます。

**重要**: `knowledgeBase`は**リスト**であり、単一のオブジェクトではありません!

**ナレッジベースの例:**

```json
{
  "name": "advanced-kb-check",
  "input": {
    "document_paths": ["your_document.pdf"],
    "check_name": "消防法コンプライアンス",
    "check_description": "地域の消防法への準拠を確認",
    "language_name": "日本語",
    "tool_configuration": {
      "knowledgeBase": [
        {
          "knowledgeBaseId": "YOUR_KB_ID",
          "dataSourceIds": null
        }
      ],
      "codeInterpreter": false,
      "mcpConfig": null
    }
  },
  "expected_output": { "result": "pass" }
}
```

**複数のナレッジベース:**

```json
"tool_configuration": {
  "knowledgeBase": [
    {"knowledgeBaseId": "KB-regulations", "dataSourceIds": null},
    {"knowledgeBaseId": "KB-standards", "dataSourceIds": ["src-1"]}
  ]
}
```

**CLI でツール設定を使用:**

1. 上記のテストケースを`my_tests/compliance_with_kb.json`に保存(`YOUR_KB_ID`を実際のナレッジベース ID に置き換える)
2. 実行:
   ```bash
   cd review-item-processor
   uv run python evals/scripts/run_eval.py --case my_tests/compliance_with_kb.json
   ```

インラインコメント付きの詳細なフィールドドキュメントについては、`my_tests/template.json`を参照してください。
