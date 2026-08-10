# Review & Assessment Powered by Intelligent Documentation (RAPID)

| ドキュメント                                                        | 言語                                                                                       |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| README（このページ）                                                | [English](../../README.md) \| [日本語](README_ja.md)                                        |
| デプロイオプション（CloudShell のオプション・閉域網・AI モデル）    | [English](../en/deployment-options.md) \| [日本語](./deployment-options.md)                 |
| 開発者ガイド（アーキテクチャ・トラブルシューティング）              | [English](../en/developer-guide.md) \| [日本語](./developer-guide.md)                       |
| ローカル開発（手元でアプリを実行）                                  | [English](../en/local-development.md) \| [日本語](./local-development.md)                   |
| サンプル集（業界別のサンプルシナリオと書類）                        | [English](../../examples/en/README.md) \| [日本語](../../examples/ja/README.md)             |

このサンプルは生成 AI (Amazon Bedrock) を活用した書類審査ソリューションです。膨大な書類と複雑なチェックリストによる審査業務を、Human in the Loop アプローチで効率化します。チェックリストの構造化から AI による審査、そして人間の最終判断までの一連のプロセスをサポートし、審査時間の短縮と品質向上を実現します。

![](../imgs/ja_review_result.png)

> [!Important]
> このツールは意思決定支援のみを目的としており、専門的判断や法的助言を提供するものではありません。すべての最終判断は適切な資格を持つ人間の専門家が行う必要があります。

> [!Warning]
> 本サンプルは予告なく破壊的な変更を行う恐れがあります。

## 仕組み

RAPID では、書類審査を 2 つのフェーズに分けて行います。

1. **チェックリストを作成** — 規程・ガイドライン・仕様書など、書類のどの箇所をどうチェックするかを示した書類（PDF）をアップロードすると、AI が審査項目をチェックリストとして抽出します。
2. **審査を実行** — 審査対象の書類（PDF・画像）をアップロードして突合させるチェックリストを選ぶと、AI が各項目を**合格／不合格で判定し**、信頼度スコア・AI の判断理由・参照した書類を提示します。

RAPID は AWS のサーバーレスサービス（Amazon CloudFront、API Gateway + Lambda、Step Functions、Aurora Serverless v2、Amazon Bedrock / AgentCore）で構成されています。アーキテクチャ図は[開発者ガイド](./developer-guide.md#アーキテクチャ)をご覧ください。

## 主な機能

- **AI によるチェックリスト抽出** — 規程・ガイドライン・仕様書などをチェックリストへ自動変換します。
- **AI による書類審査** — チェック項目ごとに合格／不合格を判定し、信頼度スコア・AI の判断理由・参照した書類をあわせて提示します。
- **チェック項目ごとのモデル選択** — チェック項目ごとに任意の生成 AI モデルを割り当てられるため、難しい項目にだけ高精度なモデルを使うといった使い分けができます。
- **エージェントツール** — 外部ツールの知識が必要なチェック項目には、**Amazon Bedrock Knowledge Bases**（RAG）、**AgentCore Code Interpreter**（計算・検証のためのコード実行）、**MCP（Model Context Protocol）** サーバをオプションで付与できます。
- **プロンプトのカスタマイズ** — チェックリスト抽出に使うシステムプロンプトを、専用の「プロンプト管理」画面から確認・編集できます。
- **業界別サンプルギャラリー** — 不動産・IT・製造・医療・コーポレートガバナンスなど、業界別のサンプルシナリオを内蔵しており、RAPID による書類審査をすぐに試せます。
- **閉域網デプロイ** — RAPID をインターネットに公開せずに運用できます。**AWS Site-to-Site VPN** や **AWS Direct Connect** と組み合わせることで、オンプレミスのネットワークから完全にプライベートな通信で利用できます。詳細は[閉域網デプロイ](#閉域網デプロイ)をご覧ください。
- **同時実行数の制御** — 同時実行数を制御し、Amazon Bedrock のクォータ内に収まるように審査を実行します。

<details>
<summary><strong>主要画面のスクリーンショット</strong>（クリックで展開）</summary>

![](../imgs/ja_new_review.png)

![](../imgs/ja_new_review_floor_plan.png)

![](../imgs/ja_review_result.png)

![](../imgs/ja_review_result_ng.png)

</details>

## 主なユースケース

- **製品仕様書の要件適合審査** — 仕様書が要求仕様や業界標準を満たしているかの確認を効率化し、レビュアーは最終確認に集中できます。
- **技術マニュアルの品質確認** — 技術マニュアルが社内ガイドラインや業界標準に準拠しているかを確認し、記載漏れや矛盾を自動で検出します。
- **調達文書のコンプライアンス確認** — 数百ページにわたる調達文書や提案書から必要な情報を自動で抽出し、照合結果を人間が最終確認します。

サンプル書類つきの具体的なシナリオは[サンプル集](../../examples/ja/README.md)で公開しています。

## デプロイ方法

### 1. CloudShell を使用したデプロイ（簡単に始めたい方向け）

ローカル環境の準備が不要で、AWS CloudShell を使用してブラウザから直接デプロイできる方法です。

1. **Amazon Bedrock で利用するモデルの確認**

   Amazon Bedrock は、スタックをデプロイしたリージョン（AWS CloudShell を開いたリージョン）のものを使用します。デプロイ先のリージョンで対象のモデル（推論プロファイル）が有効になっていることを確認してください。クロスリージョン（`global.` / `us.` / `eu.` / `apac.` / `jp.`）の推論プロファイルを利用する場合は、[AI モデルのカスタマイズ](./deployment-options.md#ai-モデルのカスタマイズ)をご覧ください。

2. **AWS CloudShell を開く**

   [AWS CloudShell](https://console.aws.amazon.com/cloudshell/home) をデプロイしたいリージョンで開きます。

3. **デプロイスクリプトの実行**

   ```bash
   wget -O - https://raw.githubusercontent.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation/main/bin.sh | bash
   ```

   このコマンドで、リポジトリのクローンからデプロイまでが自動的に実行されます。デプロイが完了するとフロントエンド URL と API の URL が表示されるので、フロントエンド URL にブラウザからアクセスして利用を開始できます。

4. **カスタムオプションの指定（任意）**

   ```bash
   wget -O - https://raw.githubusercontent.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation/main/bin.sh | bash -s -- --ipv4-ranges '["192.168.0.0/16"]'
   ```

   `--ipv4-ranges` や `--closed-network` などのオプションは、[パラメータカスタマイズ](#パラメータカスタマイズ)で説明する CDK パラメータに対応しています。オプションの一覧は [CloudShell デプロイのオプション](./deployment-options.md#cloudshell-デプロイのオプション)をご覧ください。

> [!Important]
> このデプロイ方法では、オプションパラメータを設定しない場合、URL を知っている誰もがサインアップできます。本番環境で使用する場合は、IP アドレス制限の追加とセルフサインアップの無効化（`--cognito-self-signup false`）を強く推奨します。

### 2. ローカル環境からのデプロイ（カスタマイズが必要な場合に推奨）

> [!Note]
> この方法では、ローカルに **Docker** がインストールされ、起動している必要があります。CDK のビルドで複数の Lambda 関数をコンテナイメージとしてバンドルするためです（Prisma データベースマイグレーション、審査処理、AgentCore ランタイム）。併せて、Node.js と対象アカウント／リージョンへの権限を持つ AWS 認証情報も必要です。

- このリポジトリをクローンします。

```
git clone https://github.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation.git
cd review-and-assessment-powered-by-intelligent-documentation
```

- 必要に応じて [parameter.ts](../../cdk/lib/parameter.ts) を編集します。詳細は[パラメータカスタマイズ](#パラメータカスタマイズ)をご覧ください。
- 初回のデプロイ前に、デプロイ先のリージョンに対して一度だけブートストラップを実行します。export した `AWS_DEFAULT_REGION` は bootstrap と deploy の両方に適用されます。`npx cdk bootstrap aws://<account-id>/<region>` の形式で、コマンドごとにリージョンを指定することもできます。ブートストラップの前に `cdk/` で `npm ci` を実行してください。`cdk bootstrap` は `cdk/bin/rapid.ts` の CDK アプリを読み込むため、クローン直後（依存関係が未インストール）では AWS へ到達する前に失敗します。CloudFront 用の WAF スタックのために `us-east-1` も同時にブートストラップされます（S3 + API Gateway 構成・閉域構成では当該スタックを作らないため対象外です）。

```
cd cdk
npm ci
export AWS_DEFAULT_REGION="<region>"
npx cdk bootstrap
```

- デプロイします（全パッケージのビルドとデプロイを自動で実行します）。

```
cd cdk
npm run deploy
```

<details><summary>手動でステップごとにデプロイする場合</summary>

バックエンドを準備します。

```bash
cd backend
npm ci
npm run prisma:generate
npm run build
```

続いて CDK パッケージをインストールし、デプロイします。

```bash
cd ../cdk
npm ci
npx cdk deploy --require-approval never --all
```

</details>

- 以下のような出力が表示されます。Web アプリの URL は `RapidStack.FrontendURL` に出力されるので、ブラウザからアクセスしてください。

```sh
 ✅  RapidStack

✨  deployment time: 78.57s

Output:
...
RapidStack.FrontendURL = https://xxxxx.cloudfront.net
```

### 後片付け（スタックの削除）

このサンプルが作成したリソースをすべて削除し、課金を止めるには、2 つの CDK スタックを削除します。`cdk` ディレクトリで次を実行してください。

```bash
cd cdk
npx cdk destroy --all
```

`--all` を付けると、CDK が依存関係の順序でスタックを削除します（`RapidStack` を先に、**us-east-1** にある `RapidFrontendWafStack` を後に削除します）。

> [!Warning]
> 本サンプルは Demo/PoC 向けの構成です。S3 バケット、Aurora データベース、および（スタックが新規作成した場合の）Cognito User Pool は、**保存データやユーザーアカウントも含めて** destroy で削除されます。保持設定や削除保護は行っていません。必要なものは事前にバックアップし、実運用では削除ポリシーの変更を検討してください。

インポートした Cognito User Pool、一部の CloudWatch Logs ロググループ、CloudShell デプロイが作成する `RapidCodeBuildDeploy` スタックなど、いくつかのリソースは自動では削除されません。また VPC モードでは、サービス管理の ENI が解放されるまで `cdk destroy` が一時的に `DELETE_FAILED` になることがあります。いずれも[後片付けの詳細](./deployment-options.md#後片付けの詳細)をご覧ください。

## パラメータカスタマイズ

CDK デプロイ時に以下のパラメータをカスタマイズできます。[`cdk/lib/parameter.ts`](../../cdk/lib/parameter.ts) を編集してください。

| パラメータグループ     | パラメータ名                         | 説明                                                                                                                                                                   | デフォルト値                              |
| ---------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **WAF 設定**           | allowedIpV4AddressRanges             | フロントエンド WAF で許可する IPv4 範囲                                                                                                                                | ["0.0.0.0/1", "128.0.0.0/1"] (すべて許可) |
|                        | allowedIpV6AddressRanges             | フロントエンド WAF で許可する IPv6 範囲                                                                                                                                | ["0000::/1", "8000::/1"] (すべて許可)     |
| **Cognito 設定**       | cognitoUserPoolId                    | 既存の Cognito User Pool ID                                                                                                                                            | 新規作成                                  |
|                        | cognitoUserPoolClientId              | 既存の Cognito User Pool Client ID                                                                                                                                     | 新規作成                                  |
|                        | cognitoDomainPrefix                  | Cognito ドメインのプレフィックス                                                                                                                                       | 自動生成                                  |
|                        | cognitoSelfSignUpEnabled             | Cognito User Pool のセルフサインアップを有効にするかどうか                                                                                                             | true (有効)                               |
| **マイグレーション**   | autoMigrate                          | デプロイ時に自動的にデータベースマイグレーションを実行するかどうか                                                                                                     | true (自動実行する)                       |
| **Bedrock**           | defaultModelId                  | アプリ全体（ドキュメント処理・画像レビュー・チェックリスト生成・曖昧性検出・WebUI の既定）で使う既定の AI モデルを指定します。`availableModels` による項目個別の選択が優先されます。                                                                                                       | global.anthropic.claude-sonnet-5                                                               |
|                       | availableModels                 | チェックリスト項目ごとに選択できるモデルの一覧を指定します。モデル ID には、デプロイリージョンと整合する推論プロファイルのプレフィックス（`global.` / `jp.` など）が必要です（[AI モデルのカスタマイズ](./deployment-options.md#ai-モデルのカスタマイズ)参照）。空配列 `[]` にするとモデル選択 UI が非表示になります。                                                | Claude Sonnet 5 (Global)・Opus 4.8 / 4.7・Sonnet 4.6・Haiku 4.5 (Global / JP) と Opus 4.6 (Global) |
| **MCP 機能**           | mcpAdmin                             | MCP ランタイム Lambda 関数に管理者権限を付与するかどうか                                                                                                               | false (無効)                              |
| **Citations API**      | enableCitations                      | PDF ドキュメントの Citations API を有効にするかどうか ([AWS 発表](https://aws.amazon.com/about-aws/whats-new/2025/06/citations-api-pdf-claude-models-amazon-bedrock/)) | true (有効)                               |
| **ネットワークモード** | s3ApiGatewayFrontend                 | CloudFront の代わりに専用の REGIONAL API Gateway（S3 プロキシ）経由で SPA を配信する。ネットワーク構成は標準のまま。詳細は[閉域網デプロイ](#閉域網デプロイ)をご覧ください。 | false                                     |
|                        | closedNetwork                        | 完全プライベートモード: 分離サブネット、NAT なし、VPC エンドポイント、PRIVATE API Gateway、Cognito PrivateLink。`s3ApiGatewayFrontend` を含意する。詳細は[閉域網デプロイ](#閉域網デプロイ)をご覧ください。 | false                                     |
|                        | agentCoreNetworkMode                 | AgentCore Runtime のネットワークモード（`closedNetwork` 時のみ適用）。`PUBLIC` = ランタイムにインターネットあり（MCP/uv 動作）、`VPC` = ランタイム完全分離。呼び出し経路はいずれもプライベート | PUBLIC                                    |
| **Map State 並行処理** | reviewMapConcurrency                 | レビュープロセッサの Map State 並行処理数 (スロットリングと相談して設定が必要)                                                                                         | 1                                         |
|                        | checklistInlineMapConcurrency        | チェックリストプロセッサーのインライン Map State 並行処理数 (スロットリングと相談して設定が必要)                                                                       | 1                                         |
| **審査キュー設定**     | reviewMaxConcurrency                 | 審査キューコンシューマの Step Functions 同時実行数の上限                                                                                                               | 2                                         |
|                        | reviewQueueMaxDepth                  | API がグローバル同時実行数エラーを返すまでのキューの最大深さ                                                                                                           | 10                                        |
|                        | reviewQueueMaxQueueCountMs           | 審査キューコンシューマがエラー処理に移るまでの最大待機時間（ミリ秒）                                                                                                   | 86,400,000 (24時間)                       |
|                        | reviewQueueLogLevel                  | 審査キュー Lambda のログレベル                                                                                                                                         | WARNING                                   |
| **スケジュール設定**   | feedbackAggregatorScheduleExpression | Feedback Aggregator の実行スケジュール（EventBridge Scheduler expression 形式）                                                                                        | cron(0 2 * * ? *) (毎日 2:00 UTC)         |

**Schedule Expression 形式:**

- Cron 形式: `cron(分 時 日 月 曜日 年)` - 例: `cron(0 2 * * ? *)` (毎日 2:00 UTC)
- Rate 形式: `rate(値 単位)` - 例: `rate(1 day)` (毎日)、`rate(12 hours)` (12 時間ごと)
- 詳細: [Schedule types on EventBridge Scheduler](https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html)

> [!Caution]
> デフォルト値は、本番運用での堅牢さよりも簡単に試せることを優先しています。
>
> - **WAF の IP 制限**: 既定値は**すべての** IP アドレスを許可します。本番環境では、許可したい具体的な IP 範囲を設定してください。
> - **セルフサインアップ**は既定で有効です。本番環境では `cognitoSelfSignUpEnabled: false` の設定を強く推奨します。有効のままにすると、URL に到達した誰もがアカウント登録できます。
> - **autoMigrate** はデプロイのたびに自動でデータベースマイグレーションを実行します。本番環境や重要なデータを含む環境では、`false` に設定してマイグレーションを手動で制御することを検討してください。

### 閉域網デプロイ

`closedNetwork: true` を設定すると、RAPID を完全閉域構成でデプロイします。VPC は isolated サブネットのみ（NAT／インターネットゲートウェイなし）で構成され、実行時の AWS アクセスは VPC エンドポイント経由になり、2 つの API Gateway はいずれも PRIVATE エンドポイントになります。アプリケーションへは VPC 内部からのみアクセスできます。たとえば AWS Client VPN・AWS Site-to-Site VPN・AWS Direct Connect で VPC に接続したオンプレミスのネットワークから利用します。CloudFront を避けつつ公開は維持したい場合は、代わりに `s3ApiGatewayFrontend: true` を使用してください。

閉域モードには、デプロイの実行時にはインターネットアクセスが必要であること、認証が Cognito の SRP 方式に限定されること、既存スタックでのモード切り替えは VPC の置換を伴うことなど、いくつかの制約があります。有効化する前に必ず[閉域網デプロイの詳細](./deployment-options.md#閉域網デプロイ)をご確認ください。

### AI モデルのカスタマイズ

RAPID では Strands エージェントがファイル読み込みなどのツールを使用するため、**ツール使用に対応したモデル**を選択する必要があります。アプリ全体の既定モデル（`defaultModelId`）と項目ごとの選択リスト（`availableModels`）は `parameter.ts` で変更できます。チェック項目にモデルが選択されていない場合、審査は既定モデルにフォールバックします。同梱モデルの一覧、リージョンと推論プロファイルに関する注意、設定例、モデル追加時の単価の登録方法は、[AI モデルのカスタマイズ](./deployment-options.md#ai-モデルのカスタマイズ)をご覧ください。

## 料金について

このソリューションでは、インフラ固定費（目安は約 5 ドル/日、約 150 ドル/月。NAT Gateway と Aurora Serverless v2 が主なコスト要因です）に加えて、ドキュメント処理量に応じた Amazon Bedrock の利用料金（従量課金）が発生します。

| モデルの種類                              | 1 回の審査で扱えるページ数（コンテキストウィンドウによる目安） | コスト例                 |
| ----------------------------------- | -------------------------------- | -------------------- |
| 予算重視の軽量モデル（Claude Haiku 4.5 など）     | 約 80〜85 ページ                      | 80 ページで約 0.28 ドル     |
| 高精度大容量モデル（Claude Opus 4.x など）       | 約 430 ページ                        | 400 ページで約 5.75 ドル    |

> [!Important]
> 実際のコストは、お手元のサンプルドキュメントでテストして確認してください。コストはテキスト量、画像の数とサイズ、チェックリストの項目数、ツール（Knowledge Bases、Code Interpreter など）の利用状況によって大きく変動します。審査結果画面に表示される料金は、その 1 回の審査のトークン利用量のみに基づく推定値であり、実際の費用と一致しない場合があります。

## ユーザー権限と管理者セットアップ

### 権限（管理者 / 一般ユーザー）

- **管理者**: すべてのチェックリストセット／審査を閲覧・操作できます（owner 制限なし）。
- **一般ユーザー**: 自分が所有するリソースのみアクセスできます（owner 制限あり）。

| 対象           | 作成者     | 操作 | 管理者 | 一般ユーザー |
| -------------- | ---------- | ---- | ------ | ------------ |
| チェックリスト | 自分が作成 | 閲覧 | ○      | ○            |
| チェックリスト | 自分が作成 | 編集 | ○      | ○            |
| チェックリスト | 自分が作成 | 削除 | ○      | ○            |
| チェックリスト | 他者が作成 | 閲覧 | ○      | ×            |
| チェックリスト | 他者が作成 | 編集 | ○      | ×            |
| チェックリスト | 他者が作成 | 削除 | ○      | ×            |
| 審査           | 自分が作成 | 閲覧 | ○      | ○            |
| 審査           | 自分が作成 | 編集 | ○      | ○            |
| 審査           | 自分が作成 | 削除 | ○      | ○            |
| 審査           | 他者が作成 | 閲覧 | ○      | ×            |
| 審査           | 他者が作成 | 編集 | ○      | ×            |
| 審査           | 他者が作成 | 削除 | ○      | ×            |

### 管理者の初期セットアップ

このプロジェクトは Cognito のカスタム属性 `rapid_role` を使用します。ID トークンに `custom:rapid_role=admin` が含まれる場合、バックエンドはそのユーザーを管理者として扱います。

1. Cognito User Pool で対象ユーザーのカスタム属性 `rapid_role` を `admin` に設定します。
2. ログイン後、ID トークンに `custom:rapid_role=admin` が含まれることを確認します。

ローカル開発では `RAPID_LOCAL_DEV=true` を設定すると管理者として動作します。

## コンタクト

- [Takehiro Suzuki](https://github.com/statefb)
- [Kenta Sato](https://github.com/kenta-sato3)

## コントリビューション

[CONTRIBUTING](../../CONTRIBUTING.md) をご確認ください。

## ライセンス

本プロジェクトは [LICENSE](../../LICENSE) に記載されたライセンスの下で配布されています。
