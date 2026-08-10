/**
 * CDKデプロイのカスタムパラメータ設定ファイル
 *
 * このファイルは、CDKデプロイ時に使用するパラメータをカスタマイズするためのものです。
 * デフォルトでは空のオブジェクトになっています。
 * 変更したいパラメータがある場合のみ、以下のサンプルのようにコメントを外して値を設定してください。
 */

export const parameters = {
  // カスタマイズしたいパラメータのみコメントを外して設定
  // ---------------------------------------------------
  // WAF IP制限の設定
  // アクセスを許可するIPアドレス範囲を指定します
  // デフォルト値は全てのIPアドレスを許可します
  // ---------------------------------------------------
  // allowedIpV4AddressRanges: [
  //   "192.168.0.0/16",  // 内部ネットワーク例
  //   "203.0.113.0/24"   // 特定のパブリックIP範囲例
  // ],
  //
  // allowedIpV6AddressRanges: [
  //   "2001:db8::/32"    // IPv6アドレス範囲例
  // ],
  // Bedrock設定
  // Amazon Bedrockを利用するリージョンを指定します
  // ---------------------------------------------------
  // bedrockRegion: "us-east-1", // Bedrockを利用するリージョン（デフォルト：us-west-2）
  // AI モデル設定
  // デフォルトモデル以外を使用したい場合に設定します
  // model-id-consolidation: documentProcessingModelId / imageReviewModelId は
  // 単一の defaultModelId に統合されました（旧 2 名は後方互換のため引き続き受け付けます）
  // アプリ全体（チェックリスト生成・書類審査）で使用する既定モデルです。
  // チェックリスト項目ごとにモデルを選択した場合（availableModels）は、そちらが優先されます。
  // 注意: モデルIDのプレフィックス（global., jp., us. など）はデプロイ先リージョンで
  // 利用可能な推論プロファイルを選んでください
  // 詳細: https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html
  // ---------------------------------------------------
  // defaultModelId: "global.anthropic.claude-sonnet-5", // Claude Sonnet 5 (Global) — default: "global.anthropic.claude-sonnet-5"
  // defaultModelId: "global.anthropic.claude-sonnet-4-6", // Claude Sonnet 4.6 (Global)
  // defaultModelId: "jp.anthropic.claude-sonnet-4-6", // Claude Sonnet 4.6 (JP)
  // defaultModelId: "global.anthropic.claude-opus-4-8", // Claude Opus 4.8 (Global)
  // defaultModelId: "jp.anthropic.claude-opus-4-8", // Claude Opus 4.8 (JP)
  // defaultModelId: "global.anthropic.claude-opus-4-7", // Claude Opus 4.7 (Global)
  // defaultModelId: "jp.anthropic.claude-opus-4-7", // Claude Opus 4.7 (JP)
  // defaultModelId: "global.anthropic.claude-opus-4-6-v1", // Claude Opus 4.6 (Global)
  // defaultModelId: "global.anthropic.claude-haiku-4-5-20251001-v1:0", // Claude Haiku 4.5 (Global)
  // defaultModelId: "jp.anthropic.claude-haiku-4-5-20251001-v1:0", // Claude Haiku 4.5 (JP)
  // チェックリスト項目ごとに選択可能なモデル一覧
  // 以下のコメントアウトされた一覧はスキーマのデフォルトと同一です
  // カスタマイズする場合はコメントを外して編集してください
  // 空配列に設定するとモデル選択UIが非表示になります
  // モデルを追加する場合は review-item-processor/model_config.py への価格登録も必要です
  // ---------------------------------------------------
  // availableModels: [
  //   {
  //     modelId: "global.anthropic.claude-sonnet-5",
  //     displayName: "Claude Sonnet 5 (Global)",
  //   },
  //   {
  //     modelId: "global.anthropic.claude-opus-4-8",
  //     displayName: "Claude Opus 4.8 (Global)",
  //   },
  //   {
  //     modelId: "jp.anthropic.claude-opus-4-8",
  //     displayName: "Claude Opus 4.8 (JP)",
  //   },
  //   {
  //     modelId: "global.anthropic.claude-opus-4-7",
  //     displayName: "Claude Opus 4.7 (Global)",
  //   },
  //   {
  //     modelId: "jp.anthropic.claude-opus-4-7",
  //     displayName: "Claude Opus 4.7 (JP)",
  //   },
  //   {
  //     modelId: "global.anthropic.claude-opus-4-6-v1",
  //     displayName: "Claude Opus 4.6 (Global)",
  //   },
  //   {
  //     modelId: "global.anthropic.claude-sonnet-4-6",
  //     displayName: "Claude Sonnet 4.6 (Global)",
  //   },
  //   {
  //     modelId: "jp.anthropic.claude-sonnet-4-6",
  //     displayName: "Claude Sonnet 4.6 (JP)",
  //   },
  //   {
  //     modelId: "global.anthropic.claude-haiku-4-5-20251001-v1:0",
  //     displayName: "Claude Haiku 4.5 (Global)",
  //   },
  //   {
  //     modelId: "jp.anthropic.claude-haiku-4-5-20251001-v1:0",
  //     displayName: "Claude Haiku 4.5 (JP)",
  //   },
  // ],
  // // モデル選択UIを無効にする場合:
  // // availableModels: [],
  // Cognito認証関連の設定
  // 既存のCognitoリソースをインポートして使用する場合に設定します
  // 設定しない場合は新しいリソースが作成されます
  // ---------------------------------------------------
  // cognitoUserPoolId: "ap-northeast-1_xxxxxxxxx", // 既存のCognito User Pool ID
  // cognitoUserPoolClientId: "1example23456789", // 既存のCognito User Pool Client ID
  // cognitoDomainPrefix: "myapp-login", // Cognitoドメインのプレフィックス
  // cognitoSelfSignUpEnabled: false, // Cognito User Poolのセルフサインアップを無効化（セキュリティ強化のため推奨）
  // Prismaマイグレーション設定
  // デプロイ時に自動的にマイグレーションを実行するかどうか
  // ---------------------------------------------------
  // autoMigrate: true, // デフォルトはtrue（自動マイグレーションを実行する）
  // Citation機能設定
  // Amazon Bedrock Citations API for PDF documents with Claude models
  // Ref: https://aws.amazon.com/about-aws/whats-new/2025/06/citations-api-pdf-claude-models-amazon-bedrock/
  // ---------------------------------------------------
  // enableCitations: false, // Citation機能を無効にする（デフォルト：true）
  // Map State並行処理設定
  // 並行処理数はサービスの負荷とスロットリングに影響します
  // ---------------------------------------------------
  // reviewMapConcurrency: 1, // レビュープロセッサのMap State並行処理数（デフォルト：1）
  // checklistInlineMapConcurrency: 1, // チェックリストプロセッサのインラインMap State並行処理数（デフォルト：1）
  // AgentCore Code Interpreter設定
  // ---------------------------------------------------
  // enableCodeInterpreter: false, // AgentCore Code Interpreterを無効にする（デフォルト：true）
  // Feedback Aggregator スケジュール設定
  // EventBridge schedule expressionの形式で指定します
  // 例: "cron(0 2 * * ? *)" - 毎日2:00 UTC
  // 例: "rate(1 day)" - 1日ごと
  // 例: "rate(12 hours)" - 12時間ごと
  // ---------------------------------------------------
  // feedbackAggregatorScheduleExpression: "cron(0 10 * * ? *)", // 毎日10:00 UTC
  // Review queue processor settings
  // (If not set here, defaults from parameter-schema.ts are used.)
  // reviewMaxConcurrency: 2, // Max concurrent Step Functions executions
  // reviewQueueMaxDepth: 10, // Max queue depth for global concurrency checks
  // reviewQueueMaxQueueCountMs: 86400000, // Max queue wait time in ms before error handling
  // reviewQueueLogLevel: "WARNING", // Review queue lambda log level
  //
  // ---------------------------------------------------
  // Closed / private network mode settings
  // Two orthogonal booleans (both default false = standard CloudFront mode):
  //  - s3ApiGatewayFrontend: serve the SPA from S3 via a dedicated REGIONAL
  //    API Gateway (S3 proxy) instead of CloudFront, keeping standard networking.
  //    Use this to validate the S3+APIGW delivery path in an internet-connected env.
  //  - closedNetwork: full private mode (isolated subnets, no NAT, VPC endpoints,
  //    PRIVATE API Gateways, AgentCore VPC, Cognito PrivateLink). Implies the
  //    S3+APIGW frontend.
  // ---------------------------------------------------
  // s3ApiGatewayFrontend: true, // Intermediate mode: S3 + dedicated REGIONAL API Gateway frontend
  // closedNetwork: true, // Full closed network mode (implies s3ApiGatewayFrontend)
  //
  // AgentCore Runtime network mode (only takes effect when closedNetwork: true):
  //  - "PUBLIC" (default): runtime runs on AWS-managed networking with internet
  //    access. Required for stdio/public-HTTP MCP tools and uv/npx runtime
  //    fetches. The invoke path (Lambda -> AgentCore) is still private via the
  //    bedrock-agentcore VPC endpoint.
  //  - "VPC": runtime runs inside the isolated VPC with no internet (maximum
  //    isolation). stdio/public-HTTP MCP and uv runtime fetches will NOT work;
  //    only in-VPC HTTP MCP or AgentCore Gateway MCP tools work.
  // agentCoreNetworkMode: "VPC",
};
