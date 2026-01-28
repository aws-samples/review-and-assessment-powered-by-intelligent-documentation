import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import { Construct } from "constructs";
import * as path from "path";
import { NagSuppressions } from "cdk-nag/lib/nag-suppressions";
import * as iam from "aws-cdk-lib/aws-iam";

export interface ReviewQuequeProcessorProps {
  /**
   * Lambda関数に渡す環境変数（例：SQSのURLなど）
   */
  environment?: { [key: string]: string };

  /**
   * Lambdaログ保持期間(日数)
   * parameter-schema.ts 由来の値を推奨
   */
  lambdaLogRetentionDays?: number;
}

export class ReviewQueueProcessor extends Construct {
  public readonly lambdaFunction: lambda.Function;
  public readonly queue: sqs.Queue;

  constructor(
    scope: Construct,
    id: string,
    props: ReviewQuequeProcessorProps = {}
  ) {
    super(scope, id);

    // メインキューの作成（DLQなし）
    this.queue = new sqs.Queue(this, "MainQueue", {
      // セキュリティ設定（SSE: AWS管理キー、SSL必須）
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,

      // FIFO（順序保証）に設定
      fifo: true,

      // 可視性タイムアウト（Lambda実行時間の6倍を推奨：3分 × 6 = 18分）
      visibilityTimeout: cdk.Duration.minutes(18),

      // 保持期間設定（再試行を考慮して4日間保持）
      retentionPeriod: cdk.Duration.days(4),

      // メッセージ遅延（0で無効）
      deliveryDelay: cdk.Duration.seconds(0),

      // DLQは設定しない（SQSの保持期間内で再配信。失敗管理はアプリ側で実施）
      contentBasedDeduplication: true, // FIFOの本文ベース重複排除

      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // レビューキューを処理する Python Lambda 関数の作成
    this.lambdaFunction = new lambda.Function(this, "PythonFunction", {
      // ランタイム設定
      runtime: lambda.Runtime.PYTHON_3_14,
      handler: "lambda_function.lambda_handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../../lambda/process_review_queue")
      ),

      // タイムアウトとメモリ設定
      timeout: cdk.Duration.minutes(3),
      memorySize: 512,

      // 環境変数
      environment: {
        QUEUE_URL: this.queue.queueUrl,
        ...props.environment,
      },

      // セキュリティ設定
      reservedConcurrentExecutions: 1, // 同時実行を1に制限（順序性・スロットリングの担保）

      // ログ保持期間（props.lambdaLogRetentionDaysがあれば優先、なければ3年デフォルト）
      logRetention:
        props.lambdaLogRetentionDays !== undefined
          ? props.lambdaLogRetentionDays
          : cdk.aws_logs.RetentionDays.THREE_YEARS,

      // 非同期Invoke時の再試行設定（SQSイベントソースには未適用）
      retryAttempts: 0, // 明示的に0（SQSは可視性タイムアウトにより再配信）
    });

    // SQSをLambdaのトリガーとして設定
    const eventSource = new lambdaEventSources.SqsEventSource(this.queue, {
      batchSize: 1, // 1メッセージずつ処理
      reportBatchItemFailures: true, // 部分失敗時に該当メッセージのみ再試行
    });

    this.lambdaFunction.addEventSource(eventSource);

    // SQSからの受信/削除/可視性変更に必要な明示権限（grantConsumeMessagesと併用）
    this.lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:ChangeMessageVisibility",
        ],
        resources: ["*"],
      })
    );

    // 別Lambdaの起動が必要なユースケースに備えInvoke権限を付与
    this.lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["lambda:InvokeFunction"],
        resources: ["*"],
      })
    );

    // Step Functionsの実行開始/一覧取得に必要な権限
    this.lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["states:ListExecutions", "states:StartExecution"],
        resources: ["*"],
      })
    );

    // Lambda関数にSQSへの権限を付与（受信/送信）
    this.queue.grantConsumeMessages(this.lambdaFunction);
    this.queue.grantSendMessages(this.lambdaFunction); // 再キューイング用

    // CloudFormation 出力
    new cdk.CfnOutput(this, "LambdaFunctionName", {
      value: this.lambdaFunction.functionName,
      description: "レビューキュー処理用 Lambda 関数名",
    });

    new cdk.CfnOutput(this, "QueueUrl", {
      value: this.queue.queueUrl,
      description: "レビューキュー（FIFO）のURL",
    });

    NagSuppressions.addResourceSuppressions(this.queue, [
      {
        id: "AwsSolutions-SQS3",
        reason:
          "本設計ではDLQを用いず、FIFO＋可視性タイムアウト＋アイテム単位の再試行（reportBatchItemFailures）で再配信/失敗管理を行うため",
      },
    ]);
  }
}
