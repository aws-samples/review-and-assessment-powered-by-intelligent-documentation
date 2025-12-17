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
  // bedrockRegion: "ap-northeast-1", // Bedrockを利用するリージョン（デフォルト：us-west-2）
  // AI モデル設定
  // デフォルトモデル以外を使用したい場合に設定します
  // 注意: モデルIDのプレフィックス（us., eu., apac.など）はbedrockRegionに対応している必要があります
  // 詳細: https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html
  // ---------------------------------------------------
  // documentProcessingModelId: "global.anthropic.claude-sonnet-4-5-20250929-v1:0", // Claude 4.5 Sonnet (Global)
  // documentProcessingModelId: "us.anthropic.claude-sonnet-4-5-20250929-v1:0", // Claude 4.5 Sonnet (US)
  // documentProcessingModelId: "eu.anthropic.claude-sonnet-4-5-20250929-v1:0", // Claude 4.5 Sonnet (EU)
  // documentProcessingModelId: "jp.anthropic.claude-sonnet-4-5-20250929-v1:0", // Claude 4.5 Sonnet (JP)
  // documentProcessingModelId: "global.anthropic.claude-sonnet-4-20250514-v1:0", // Claude 4 Sonnet (Global)
  // documentProcessingModelId: "global.anthropic.claude-sonnet-4-20250514-v1:0", // Claude 4 Sonnet (Global)
  // documentProcessingModelId: "eu.anthropic.claude-sonnet-4-20250514-v1:0", // Claude 4 Sonnet (EU)
  // documentProcessingModelId: "apac.anthropic.claude-sonnet-4-20250514-v1:0", // Claude 4 Sonnet (APAC)
  // documentProcessingModelId: "apac.anthropic.claude-3-7-sonnet-20250219-v1:0",  // 日本リージョンでClaude利用する場合
  // documentProcessingModelId: "mistral.mistral-large-2407-v1:0", // Mistral利用する場合
  // documentProcessingModelId: "us.amazon.nova-2-omni-v1:0", // Nova 2 Omni
  // imageReviewModelId: "global.anthropic.claude-sonnet-4-5-20250929-v1:0", // Claude 4.5 Sonnet (Global)
  // imageReviewModelId: "us.anthropic.claude-sonnet-4-5-20250929-v1:0", // Claude 4.5 Sonnet (US)
  // imageReviewModelId: "eu.anthropic.claude-sonnet-4-5-20250929-v1:0", // Claude 4.5 Sonnet (EU)
  // imageReviewModelId: "jp.anthropic.claude-sonnet-4-5-20250929-v1:0", // Claude 4.5 Sonnet (JP)
  // imageReviewModelId: "global.anthropic.claude-sonnet-4-20250514-v1:0", // Claude 4 Sonnet (Global)
  // imageReviewModelId: "global.anthropic.claude-sonnet-4-20250514-v1:0", // Claude 4 Sonnet (Global)
  // imageReviewModelId: "eu.anthropic.claude-sonnet-4-20250514-v1:0", // Claude 4 Sonnet (EU)
  // imageReviewModelId: "apac.anthropic.claude-sonnet-4-20250514-v1:0", // Claude 4 Sonnet (APAC)
  // imageReviewModelId: "apac.amazon.nova-premier-v1:0", // 画像レビュー用モデル（例：Nova Premier）
  // imageReviewModelId: "us.amazon.nova-2-omni-v1:0", // Nova 2 Omni
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
};
