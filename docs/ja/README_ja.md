# Review & Assessment Powered by Intelligent Documentation (RAPID)

[English](../../README.md) | [日本語](README_ja.md)

このサンプルは生成 AI (Amazon Bedrock) を活用した書類審査ソリューションです。膨大な書類と複雑なチェックリストによる審査業務を、Human in the Loop アプローチで効率化します。チェックリストの構造化から AI による審査、そして人間の最終判断までの一連のプロセスをサポートし、審査時間の短縮と品質向上を実現します。

![](../imgs/ja_summary.png)

> [!Important]
> このツールは意思決定支援のみを目的としており、専門的判断や法的助言を提供するものではありません。すべての最終判断は適切な資格を持つ人間の専門家が行う必要があります。

> [!Warning]
> 本サンプルは予告なく破壊的な変更を行う恐れがあります。

## 主なユースケース

### 製品仕様書の要件適合レビュー

製品開発における仕様書が、要求仕様や業界標準を満たしているかを効率的に確認します。年間数千件に及ぶ仕様書を、数百の確認項目と照合する作業を自動化。AI が仕様書から関連情報を抽出・構造化し、要件との照合結果を可視化。レビュアーは効率的に最終確認を行えます。

### 技術マニュアルの品質確認

複雑な技術マニュアルが社内ガイドラインや業界標準に準拠しているかを確認します。年間数万ページの技術文書を、数千項目の品質基準と照合する作業を支援。必要な技術情報の記載漏れや矛盾を自動検出し、一貫性のある高品質なマニュアル作成をサポートします。

### 調達文書のコンプライアンス確認

調達文書や提案書が必要な要件を満たしているかをチェックします。数百ページにわたる文書から必要情報を自動抽出し、年間数万件のドキュメントレビューを効率化。要件リストとの照合結果を人間が最終確認することで、調達プロセスのスピードと精度を向上させます。

## スクリーンショット

![](../imgs/ja_new_review.png)
![](../imgs/ja_new_review_floor_plan.png)
![](../imgs/ja_review_result.png)
![](../imgs/ja_review_result_ng.png)

## デプロイ方法

デプロイには以下の 2 つの方法があります：

### 1. CloudShell を使用したデプロイ（簡単に始めたい方向け）

ローカル環境の準備が不要で、AWS CloudShell を使用してブラウザから簡単に直接デプロイできる方法です。

1. **Amazon Bedrock モデルの有効化**

   AWS Management Console から Bedrock モデルアクセスにアクセスし、以下のモデルへのアクセスを有効化してください：

   - Anthropic Claude 3.7 Sonnet
   - Amazon Nova Premier

   デフォルトではオレゴン (us-west-2) リージョンを使用しますが、`--bedrock-region` オプションで変更可能です。

2. **AWS CloudShell を開く**

   [AWS CloudShell](https://console.aws.amazon.com/cloudshell/home)をデプロイしたいリージョンで開きます。

3. **デプロイスクリプトの実行**

   ```bash
   wget -O - https://raw.githubusercontent.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation/main/bin.sh | bash
   ```

   このワンライナーコマンドで、リポジトリのクローンからデプロイまでが自動的に実行されます。

4. **カスタムパラメータの指定（オプション）**

   ```bash
   wget -O - https://raw.githubusercontent.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation/main/bin.sh | bash -s -- --ipv4-ranges '["192.168.0.0/16"]'
   ```

   利用可能なオプション：

   - `--ipv4-ranges`: フロントエンド WAF で許可する IPv4 アドレス範囲（JSON 配列形式）
   - `--ipv6-ranges`: フロントエンド WAF で許可する IPv6 アドレス範囲（JSON 配列形式）
   - `--disable-ipv6`: IPv6 サポートを無効にする
   - `--auto-migrate`: デプロイ時に自動的にデータベースマイグレーションを実行するかどうか
   - `--cognito-self-signup`: Cognito User Pool のセルフサインアップを有効にするかどうか（true/false）
   - `--cognito-user-pool-id`: 既存の Cognito User Pool ID（指定しない場合は新規作成）
   - `--cognito-user-pool-client-id`: 既存の Cognito User Pool Client ID（指定しない場合は新規作成）
   - `--cognito-domain-prefix`: Cognito ドメインのプレフィックス（指定しない場合は自動生成）
   - `--mcp-admin`: MCP ランタイム Lambda 関数に管理者権限を付与するかどうか（true/false）
   - `--bedrock-region`: Amazon Bedrock を利用するリージョン（デフォルト：us-west-2）
   - `--document-model`: ドキュメント処理に使用する AI モデル ID（デフォルト：us.anthropic.claude-3-7-sonnet-20250219-v1:0）
   - `--image-model`: 画像レビューに使用する AI モデル ID（デフォルト：us.anthropic.claude-3-7-sonnet-20250219-v1:0）
   - `--repo-url`: デプロイするリポジトリの URL
   - `--branch`: デプロイするブランチ名
   - `--tag`: デプロイする特定の Git タグ

5. **デプロイ後の確認**

   デプロイが完了すると、フロントエンド URL と API の URL が表示されます。
   表示された URL にアクセスして、アプリケーションを利用開始できます。

> [!Important]
> このデプロイ方法では、オプションパラメータを設定しない場合、URL を知っている誰でもサインアップできます。本番環境での使用には、IP アドレス制限の追加やセルフサインアップの無効化 (`--cognito-self-signup=false`) を強くお勧めします。

### 2. ローカル環境からのデプロイ（カスタマイズが必要な場合に推奨）

- このリポジトリをクローン

```
git clone https://github.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation.git
```

- バックエンドの準備

```
cd review-and-assessment-powered-by-intelligent-documentation
cd backend
npm ci
npm run prisma:generate
npm run build
```

- CDK パッケージのインストール

```
cd ../cdk
npm ci
```

- 必要に応じて、[parameter.ts](./cdk/parameter.ts) を編集してください。詳細は[パラメータカスタマイズ](#パラメータカスタマイズ)をご覧ください。
- CDK をデプロイする前に、デプロイ先のリージョンに対して一度ブートストラップを実行する必要があります。

```
npx cdk bootstrap
```

- サンプルプロジェクトをデプロイ

```
npx cdk deploy --require-approval never --all
```

- 以下のような出力が表示されます。Web アプリの URL は `RapidStack.FrontendURL` に出力されますので、ブラウザからアクセスしてください。

```sh
 ✅  RapidStack

✨  deployment time: 78.57s

Output:
...
RapidStack.FrontendURL = https://xxxxx.cloudfront.net
```

## パラメータカスタマイズ

CDK デプロイ時に以下のパラメータをカスタマイズできます:

| パラメータグループ     | パラメータ名                  | 説明                                                                                                                                                                   | デフォルト値                              |
| ---------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **WAF 設定**           | allowedIpV4AddressRanges      | フロントエンド WAF で許可する IPv4 範囲                                                                                                                                | ["0.0.0.0/1", "128.0.0.0/1"] (すべて許可) |
|                        | allowedIpV6AddressRanges      | フロントエンド WAF で許可する IPv6 範囲                                                                                                                                | ["0000::/1", "8000::/1"] (すべて許可)     |
| **Cognito 設定**       | cognitoUserPoolId             | 既存の Cognito User Pool ID                                                                                                                                            | 新規作成                                  |
|                        | cognitoUserPoolClientId       | 既存の Cognito User Pool Client ID                                                                                                                                     | 新規作成                                  |
|                        | cognitoDomainPrefix           | Cognito ドメインのプレフィックス                                                                                                                                       | 自動生成                                  |
|                        | cognitoSelfSignUpEnabled      | Cognito User Pool のセルフサインアップを有効にするかどうか                                                                                                             | true (有効)                               |
| **マイグレーション**   | autoMigrate                   | デプロイ時に自動的にマイグレーションを実行するかどうか                                                                                                                 | true (自動実行する)                       |
| **MCP 機能**           | mcpAdmin                      | MCP ランタイム Lambda 関数に管理者権限を付与するかどうか ([詳細](./mcp-features.md))                                                                                   | false (無効)                              |
| **Citations API**      | enableCitations               | PDF ドキュメントの Citations API を有効にするかどうか ([AWS 発表](https://aws.amazon.com/about-aws/whats-new/2025/06/citations-api-pdf-claude-models-amazon-bedrock/)) | true (有効)                               |
| **Map State 並行処理** | reviewMapConcurrency          | レビュープロセッサの Map State 並行処理数 (スロットリングと相談して設定が必要)                                                                                         | 1                                         |
| **Map State 並行処理** | checklistInlineMapConcurrency | チェックリストプロセッサのインライン Map State 並行処理数 (スロットリングと相談して設定が必要)                                                                         | 1                                         |
| **スケジュール設定**   | feedbackAggregatorScheduleExpression | Feedback Aggregator の実行スケジュール（EventBridge Scheduler expression 形式）                                                                              | cron(0 2 * * ? *) (毎日 2:00 UTC)         |

**Schedule Expression 形式:**
- Cron 形式: `cron(分 時 日 月 曜日 年)` - 例: `cron(0 2 * * ? *)` (毎日 2:00 UTC)
- Rate 形式: `rate(値 単位)` - 例: `rate(1 day)` (1 日ごと), `rate(12 hours)` (12 時間ごと)
- 詳細: [Schedule types on EventBridge Scheduler](https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html)

### AI モデルのカスタマイズ

このアプリケーションは Strands エージェントがファイル読み込みなどのツールを使用するため、**ツール使用に対応したモデル**を選択する必要があります。

**ツール使用対応モデルの例**:

- `us.anthropic.claude-sonnet-4-20250514-v1:0` (Claude 4 Sonnet US)
- `eu.anthropic.claude-sonnet-4-20250514-v1:0` (Claude 4 Sonnet EU)
- `apac.anthropic.claude-sonnet-4-20250514-v1:0` (Claude 4 Sonnet APAC)
- `global.anthropic.claude-sonnet-4-5-20250929-v1:0` (Claude 4.5 Sonnet Global)
- `us.anthropic.claude-sonnet-4-5-20250929-v1:0` (Claude 4.5 Sonnet US)
- `eu.anthropic.claude-sonnet-4-5-20250929-v1:0` (Claude 4.5 Sonnet EU)
- `jp.anthropic.claude-sonnet-4-5-20250929-v1:0` (Claude 4.5 Sonnet JP)
- `global.anthropic.claude-sonnet-4-20250514-v1:0` (Claude 4 Sonnet Global)
- `us.anthropic.claude-sonnet-4-20250514-v1:0` (Claude 4 Sonnet US)
- `eu.anthropic.claude-sonnet-4-20250514-v1:0` (Claude 4 Sonnet EU)
- `apac.anthropic.claude-sonnet-4-20250514-v1:0` (Claude 4 Sonnet APAC)
- `mistral.mistral-large-2407-v1:0` (Mistral Large 2)
- `us.anthropic.claude-3-5-sonnet-20241022-v2:0` (Claude 3.5 Sonnet)
- `us.amazon.nova-premier-v1:0` (Amazon Nova Premier)
- `us.amazon.nova-2-omni-v1:0` (Amazon Nova 2 Omni)

**重要な注意事項**:

- **Cross-region inference profiles**: Cross-region inference を利用する場合は、`us.`, `eu.`, `apac.` などの地域プレフィックス付きモデル ID が必須です

- **公式ドキュメント**: [Amazon Bedrock でサポートされているモデルと機能](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-supported-models-features.html)

**設定例**:

```typescript
// cdk/lib/parameter.ts
export const parameters = {
  documentProcessingModelId: "us.anthropic.claude-sonnet-4-20250514-v1:0", // Claude 4 Sonnet US
  bedrockRegion: "us-west-2", // オレゴンリージョン
  // ...
};
```

設定するには`cdk/lib/parameter.ts` ファイルを直接編集してください。

> [!CAUTION]
> 本番環境では、`cognitoSelfSignUpEnabled: false` に設定することでセルフサインアップを無効化することを強く推奨します。セルフサインアップを有効にしたままにすると、誰でもアカウント登録が可能となるため、セキュリティリスクとなる可能性があります。
> デフォルトでは `autoMigrate` パラメータが `true` に設定されており、デプロイ時に自動的にデータベースマイグレーションが実行されます。本番環境や重要なデータを含む環境では、このパラメータを `false` に設定し、マイグレーションを手動で制御することを検討してください。

## 料金について

このソリューションは、インフラ固定費（約5ドル/日、約150ドル/月：NAT GatewayとAurora Serverless v2）に加えて、ドキュメント処理量に応じたBedrock利用料金が発生します。

### Bedrock利用料金（従量課金）

#### 予算重視の軽量モデル（Claude Haiku 4.5など）
- **処理可能ページ数**: 約80〜85ページ
- **コスト例（80ページ）**: 約0.28ドル

#### 高精度大容量モデル（Claude Opus 4.5など）
- **処理可能ページ数**: 約430ページ
- **コスト例（400ページ）**: 約5.75ドル

> [!Important]
> - **実際のコストは、サンプルドキュメントでテストして確認してください**
> - Amazon Bedrock Converse APIには4.5MBのファイルサイズ制限があります
> - **拡張機能（Knowledge Base、Code Interpreterなど）を使用するエージェント機能は最大10倍のコストが発生する可能性があります**
> - 詳細な料金とトークン使用量は、レビュー結果画面で確認できます

最新の料金情報については、[Amazon Bedrock料金ページ](https://aws.amazon.com/jp/bedrock/pricing/)をご覧ください。

## 開発者向け情報

- [開発者ガイド](./developer-guide.md): 技術仕様、アーキテクチャ、開発環境設定

## コンタクト

- [Takehiro Suzuki](https://github.com/statefb)
- [Kenta Sato](https://github.com/kenta-sato3)

## コントリビューション

[CONTRIBUTING](./CONTRIBUTING.md)をご確認ください。

## ライセンス

本プロジェクトは [LICENSE](./LICENSE) に記載されたライセンスの下で配布されています。
