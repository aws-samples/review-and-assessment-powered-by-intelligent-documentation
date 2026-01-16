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
uv run python evals/scripts/run_eval.py --suite ja/examples/quick_start_suite.json
```

以下のようなメトリクスが表示されます:

- Accuracy: 100% (2/2 正解)
- Recall: 100% ⭐ (すべての問題を検出)
- Critical Errors: 0 (HITL 対応として安全)

**何が起きたか?** 2 つの防火安全シナリオに対して AI エージェントをテストしました(約 1-2 分)。これらのメトリクスの意味については、以下の「コアコンセプト」セクションを参照してください。

**さらに詳しく?** 詳細な 6 ケースのウォークスルーについては、以下の「包括的な例」セクションを参照してください。

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

### 視覚的な例

```
ドキュメント: 消火器が欠落(違反)
期待される結果: FAIL
エージェントの判定: FAIL、信頼度95%

✓ 正しい予測(再現率に貢献)
✓ 適切な高信頼度(良好なキャリブレーション)
```

**次へ:** 次のセクションで実際の CLI ワークフローを使った包括的な例を参照 →

---

## 包括的な例: フロアプラン安全評価

この例は、6 つのテストケースを使用した CLI での完全な評価ワークフローを示します。

### テストシナリオ

6 つの建物フロアプランで防火コンプライアンスをテストし、証拠の品質を変化させます:

| 建物 | シナリオ                       | 期待される信頼度   |
| ---- | ------------------------------ | ------------------ |
| A    | 明確な準拠証拠                 | 高 (0.90-1.0)      |
| B    | 明確な違反証拠                 | 高 (0.90-1.0)      |
| C    | 曖昧な準拠説明                 | 低 (0.45-0.60)     |
| D    | 不完全な情報                   | 低 (0.40-0.55)     |
| E    | 部分的コンプライアンス         | 中 (0.65-0.75)     |
| F    | 微妙な違反(45 分 vs 60 分必要) | クリティカルテスト |

**目的**: エージェントが高信頼度の正しい回答と不確実なケースを区別し、微妙な違反を検出できるかをテストします。

### 使用ファイル

- **テストスイート**: `ja/examples/floor_plan_hitl_suite.json` (6 テストケース)
- **ドキュメント**: `ja/examples/fixtures/floor_plan_safety_reports.pdf` (6 ページ、建物ごとに 1 ページ)
- **正解ラベル**: テストスイート内の事前決定された合格/不合格ラベル

### 評価の実行

```bash
cd review-item-processor
uv run python evals/scripts/run_eval.py \
  --suite ja/examples/floor_plan_hitl_suite.json \
  --experiment comprehensive
```

### 期待される出力

```
✓ ja/examples/floor_plan_hitl_suite.jsonから6つのテストケースをロード
✓ 4つの評価者で実験を作成

🤖 エージェント評価を実行中...
  ケース1/6を処理中: FP001-building-a-clear-compliant...
  ケース2/6を処理中: FP002-building-b-clear-violation...
  ケース3/6を処理中: FP003-building-c-vague-compliant...
  ケース4/6を処理中: FP004-building-d-incomplete-info...
  ケース5/6を処理中: FP005-building-e-partial-compliance...
  ケース6/6を処理中: FP006-building-f-subtle-violation...

✓ 評価完了!
結果を保存: results/results_20250116_143022.json

=============================================================
精度メトリクス
=============================================================
Accuracy:  83% (5/6 正解)
Recall:    100% ⭐ (すべての違反を検出)
Precision: 80% (1件の誤検出)
F1 Score:  0.89

False Negatives: 0 (違反の見逃しなし - 良好!)
False Positives: 1 (建物Cの不要なレビュー - 許容範囲)

=============================================================
信頼度キャリブレーション (HITL安全性)
=============================================================
ECE (キャリブレーション誤差):   0.083 (良好 - <0.10)
Brier Score:                    0.120
Over-Confidence Rate:           16.7% (1/6 高信頼度で誤り)
Critical Errors (FN@HC):        0 (高信頼度の偽陰性なし)

✓ 安全閾値:                     0.85
  → 閾値以上の精度:             100%
  → 閾値以上のFN率:             0.0%
  → HITLシステムの自動承認に使用
```

### 各結果の理解

| メトリクス          | 値      | 意味                                               | これは良いか?                 |
| ------------------- | ------- | -------------------------------------------------- | ----------------------------- |
| **Accuracy**        | 83%     | エージェントは 6 つのうち 5 つの予測を正しく行った | ✓ 良好 - ほとんどの予測が正確 |
| **Recall**          | 100% ⭐ | すべての実際の違反を検出(偽陰性 0)                 | ✓ 優秀 - 本番環境で安全       |
| **Precision**       | 80%     | 5 つの"fail"予測のうち 4 つが実際の違反            | ✓ 良好 - 誤警報最小           |
| **F1 Score**        | 0.89    | 適合率と再現率のバランス指標                       | ✓ 強力な総合パフォーマンス    |
| **ECE**             | 0.083   | 信頼度スコアが精度とよく一致                       | ✓ よくキャリブレーション済    |
| **Brier Score**     | 0.120   | 精度とキャリブレーション品質の組み合わせ           | ✓ 低いほど良い(0.0 = 完璧)    |
| **Over-Confidence** | 16.7%   | 6 つの高信頼度予測のうち 1 つが誤り                | ⚠️ 許容範囲だが監視が必要     |
| **Critical Errors** | 0       | 高信頼度で違反を見逃したことがない                 | ✓ 完璧 - 危険なエラーなし     |

**重要な洞察**: 100%の再現率と 0 の重大エラーは、このエージェントが**HITL デプロイメントに安全**であることを意味します。83%の精度は許容範囲です。なぜなら、すべてのミスが偽陽性(不要な人間レビュー)であり、違反の見逃しではないからです。

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

- `metadata`: 追加情報(カテゴリ、重要度など)
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

### ステップ 4: 評価の実行

```bash
cd review-item-processor
uv run python evals/scripts/run_eval.py --suite my_tests/my_suite.json
```

上記の包括的な例と同様の出力が表示されます。

### ステップ 5: 結果の解釈

**以下の主要メトリクスに注目**:

- **Recall**: エージェントはすべての違反を検出したか?

  - 目標: 安全性/コンプライアンスで>95%
  - 低い場合: 偽陰性をレビューし、check_description を改善

- **Precision**: フラグのうち何件が実際の問題か?

  - 目標: >80%(いくつかの偽陽性は許容可能)
  - 低い場合: check_description が曖昧すぎないかチェック

- **Critical Errors**: 高信頼度の偽陰性はあるか?
  - 目標: 0(本番環境では必ずゼロ)
  - > 0 の場合: 重大 - すぐにこれらのケースをレビュー

### ステップ 6: さらにテストケースを追加

JSON を配列にしてテストスイートを作成:

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

**推奨**: 有意義なメトリクスを得るには、5-10 のテストケースから始めてください。

### ステップ 7: 結果の保存とレビュー

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

### トラブルシューティング

**"ModuleNotFoundError: No module named 'strands_evals'"**

```bash
cd review-item-processor
uv sync --extra evals
```

---

**"Agent execution failed"**

考えられる原因:

- AWS 認証情報が設定されていない: `aws configure`を実行
- リージョンで Bedrock にアクセスできない
- ドキュメントパスが正しくない

確認:

1. AWS 認証情報を確認: `aws sts get-caller-identity`
2. リージョンで Bedrock アクセスを確認
3. ドキュメントファイルが fixtures ディレクトリに存在することを確認

---

**"FileNotFoundError: Document 'xyz.pdf' not found"**

- ファイルが`my_tests/fixtures/`または`ja/examples/fixtures/`にあることを確認
- テストケースではフルパスではなくファイル名のみを使用
- ✅ 正しい: `"document_paths": ["my_doc.pdf"]`
- ❌ 誤り: `"document_paths": ["/full/path/my_doc.pdf"]`

---

**メトリクスに"No valid test cases"**

以下を確認:

- `expected_output.result`が"pass"または"fail"(小文字)であること
- エージェントが有効な結果を返したこと
- `--verbose`で実行して詳細出力を確認

---

**低い Recall (<90%)**

エージェントが違反を見逃しています。試してみる:

1. `check_description`をより具体的かつ詳細にする
2. 探すべきものの例を追加
3. ドキュメントの品質が悪い(スキャン画像など)かチェック
4. 偽陰性ケースをレビューしてパターンを見つける

---

**高い偽陽性率 (Precision <70%)**

エージェントが非問題に過度にフラグを立てています。試してみる:

1. 合格基準について`check_description`をより正確にする
2. 明確化の例を追加
3. 正解ラベルが正しいかチェック

---

**Critical Errors >0**

🚨 **重大**: エージェントが確信を持って違反を見逃しました

1. これらのケースをすぐにレビュー - 最も危険
2. エージェントがなぜ確信を持っていたのに間違っていたかを理解
3. これらのケースに対処するために`check_description`を更新
4. 修正を確認するために評価を再実行

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
