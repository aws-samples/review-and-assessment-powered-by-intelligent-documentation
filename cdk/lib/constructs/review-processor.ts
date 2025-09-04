import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaPython from "@aws-cdk/aws-lambda-python-alpha";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as path from "path";
import { Construct } from "constructs";
import { DockerPrismaFunction } from "./docker-prisma-function";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import { DatabaseConnectionProps } from "./database";
import { McpRuntime } from "./mcp-runtime/mcp-runtime";
export interface ReviewProcessorProps {
  documentBucket: s3.IBucket;
  tempBucket: s3.IBucket; // S3 Temp Storage bucket
  vpc: ec2.IVpc;
  databaseConnection: DatabaseConnectionProps;
  logLevel?: sfn.LogLevel;
  maxConcurrency?: number; // Add parameter for controlling parallel executions
  McpRuntime: McpRuntime; // MCP runner for enhanced review capabilities

  /**
   * ドキュメント処理に使用するAIモデルID
   * @default "us.anthropic.claude-3-7-sonnet-20250219-v1:0"
   */
  documentProcessingModelId: string;

  /**
   * 画像レビューに使用するAIモデルID
   * @default "us.anthropic.claude-3-7-sonnet-20250219-v1:0"
   */
  imageReviewModelId: string;

  /**
   * Amazon Bedrockを利用するリージョン
   * @default "us-west-2"
   */
  bedrockRegion: string;

  /**
   * Citation機能を有効にするかどうか
   * @default true
   */
  enableCitations: boolean;
}

export class ReviewProcessor extends Construct {
  public readonly stateMachine: sfn.StateMachine;
  public readonly reviewLambda: lambda.Function;
  public readonly reviewMcpLambda: lambda.DockerImageFunction;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: ReviewProcessorProps) {
    super(scope, id);

    const logLevel = props.logLevel || sfn.LogLevel.ERROR;
    // Use the value provided in props or default to 1
    const maxConcurrency = props.maxConcurrency || 1;

    // セキュリティグループの作成
    this.securityGroup = new ec2.SecurityGroup(
      this,
      "ReviewProcessorSecurityGroup",
      {
        vpc: props.vpc,
        description: "Security group for Review Processor Lambda function",
        allowAllOutbound: true,
      }
    );

    // 審査処理用Lambda関数を作成
    this.reviewLambda = new DockerPrismaFunction(
      this,
      "DocumentProcessorFunction",
      {
        code: lambda.DockerImageCode.fromImageAsset(
          path.join(__dirname, "../../../backend/"),
          {
            file: "Dockerfile.prisma.lambda",
            platform: Platform.LINUX_ARM64,
            cmd: ["dist/review-workflow/index.handler"],
          }
        ),
        memorySize: 1024,
        timeout: cdk.Duration.minutes(15),
        vpc: props.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        environment: {
          DOCUMENT_BUCKET: props.documentBucket.bucketName,
          TEMP_BUCKET: props.tempBucket.bucketName,
          BEDROCK_REGION: props.bedrockRegion,
          DOCUMENT_PROCESSING_MODEL_ID: props.documentProcessingModelId,
          IMAGE_REVIEW_MODEL_ID: props.imageReviewModelId,
        },
        securityGroups: [this.securityGroup],
        database: props.databaseConnection,
        architecture: lambda.Architecture.ARM_64,
      }
    );

    // Pythonベースの審査Lambda関数を作成（Docker）
    this.reviewMcpLambda = new lambda.DockerImageFunction(
      this,
      "ReviewItemProcessorMcpFunction",
      {
        code: lambda.DockerImageCode.fromImageAsset(
          path.join(
            __dirname,
            "../../../backend/src/review-workflow/review-item-processor"
          ),
          {
            file: "Dockerfile",
            platform: Platform.LINUX_ARM64,
          }
        ),
        memorySize: 1024,
        timeout: cdk.Duration.minutes(15),
        // vpc: props.vpc,
        // vpcSubnets: {
        //   subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        // },
        // securityGroups: [this.securityGroup],
        environment: {
          DOCUMENT_BUCKET: props.documentBucket.bucketName,
          TEMP_BUCKET: props.tempBucket.bucketName,
          BEDROCK_REGION: props.bedrockRegion,
          DOCUMENT_PROCESSING_MODEL_ID: props.documentProcessingModelId,
          IMAGE_REVIEW_MODEL_ID: props.imageReviewModelId,
          // MCPサーバーLambdaのARNを設定
          PY_MCP_LAMBDA_ARN: props.McpRuntime.pythonMcpServer.functionArn,
          NODE_MCP_LAMBDA_ARN: props.McpRuntime.typescriptMcpServer.functionArn,
          ENABLE_CITATIONS: props.enableCitations.toString(),
        },
        architecture: lambda.Architecture.ARM_64,
      }
    );

    // Lambda関数にS3バケットへのアクセス権限を付与
    props.documentBucket.grantReadWrite(this.reviewMcpLambda);
    props.tempBucket.grantReadWrite(this.reviewMcpLambda);

    // Lambda関数にBedrockへのアクセス権限を付与
    this.reviewMcpLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: ["*"],
      })
    );

    // MCP Lambdaへの呼び出し権限を付与
    props.McpRuntime.pythonMcpServer.grantInvoke(this.reviewMcpLambda);
    props.McpRuntime.typescriptMcpServer.grantInvoke(this.reviewMcpLambda);

    // Lambda関数にS3バケットへのアクセス権限を付与
    props.documentBucket.grantReadWrite(this.reviewLambda);
    props.tempBucket.grantReadWrite(this.reviewLambda);

    // Lambda関数にBedrockへのアクセス権限を付与
    this.reviewLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["*"],
      })
    );

    // 審査準備Lambda - チェックリスト項目を取得し、処理項目を準備
    const prepareReviewTask = new tasks.LambdaInvoke(this, "PrepareReview", {
      lambdaFunction: this.reviewLambda,
      payload: sfn.TaskInput.fromObject({
        action: "prepareReview",
        reviewJobId: sfn.JsonPath.stringAt("$.reviewJobId"),
      }),
      resultPath: "$.prepareResult",
      resultSelector: {
        "Payload.$": "$.Payload",
      },
    });

    // Map状態 - チェックリスト項目を並列処理
    const processItemsMap = new sfn.Map(this, "ProcessAllItems", {
      maxConcurrency: maxConcurrency, // Use the parameter to control concurrency
      itemsPath: sfn.JsonPath.stringAt("$.prepareResult.Payload.checkItems"),
      resultPath: "$.processedItems",
      itemSelector: {
        "reviewJobId.$": "$.reviewJobId",
        "checkId.$": "$$.Map.Item.Value.checkId",
        "reviewResultId.$": "$$.Map.Item.Value.reviewResultId",
      },
    });

    // 処理フロー定義
    // MCP対応の処理フロー - 3ステップで処理

    // Step 1: Pre-processing - データ準備
    const preProcessTask = new tasks.LambdaInvoke(
      this,
      "PreReviewItemProcessor",
      {
        lambdaFunction: this.reviewLambda,
        payload: sfn.TaskInput.fromObject({
          action: "preReviewItemProcessor",
          reviewJobId: sfn.JsonPath.stringAt("$.reviewJobId"),
          checkId: sfn.JsonPath.stringAt("$.checkId"),
          reviewResultId: sfn.JsonPath.stringAt("$.reviewResultId"),
          userId: sfn.JsonPath.stringAt("$$.Execution.Input.userId"),
        }),
        resultPath: "$.preItemResult",
        resultSelector: {
          "Payload.$": "$.Payload",
        },
      }
    );

    // Step 2: MCP processing - Strandsエージェントによる処理
    const mcpTask = new tasks.LambdaInvoke(this, "ProcessReviewWithMcp", {
      lambdaFunction: this.reviewMcpLambda,
      payload: sfn.TaskInput.fromObject({
        reviewJobId: sfn.JsonPath.stringAt("$.reviewJobId"),
        checkId: sfn.JsonPath.stringAt("$.checkId"),
        reviewResultId: sfn.JsonPath.stringAt("$.reviewResultId"),
        documentPaths: sfn.JsonPath.stringAt(
          "$.preItemResult.Payload.documentPaths"
        ),
        checkName: sfn.JsonPath.stringAt("$.preItemResult.Payload.checkName"),
        checkDescription: sfn.JsonPath.stringAt(
          "$.preItemResult.Payload.checkDescription"
        ),
        languageName: sfn.JsonPath.stringAt(
          "$.preItemResult.Payload.languageName"
        ),
        mcpServers: sfn.JsonPath.stringAt("$.preItemResult.Payload.mcpServers"),
      }),
      resultPath: "$.mcpResult",
      resultSelector: {
        "Payload.$": "$.Payload",
      },
    });

    // Step 3: Post-processing - 結果の保存
    const postProcessTask = new tasks.LambdaInvoke(
      this,
      "PostReviewItemProcessor",
      {
        lambdaFunction: this.reviewLambda,
        payload: sfn.TaskInput.fromObject({
          action: "postReviewItemProcessor",
          reviewJobId: sfn.JsonPath.stringAt("$.reviewJobId"),
          checkId: sfn.JsonPath.stringAt("$.checkId"),
          reviewResultId: sfn.JsonPath.stringAt("$.reviewResultId"),
          documentIds: sfn.JsonPath.stringAt(
            "$.preItemResult.Payload.documentIds"
          ),
          reviewData: sfn.JsonPath.stringAt("$.mcpResult.Payload"),
        }),
        resultPath: "$.itemResult",
        resultSelector: {
          "Payload.$": "$.Payload",
        },
      }
    );

    // リトライ設定を追加
    mcpTask.addRetry({
      errors: [
        "ThrottlingException",
        "ServiceQuotaExceededException",
        "TooManyRequestsException",
      ],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 5,
      backoffRate: 2,
    });

    // タスクを連鎖させる
    const processReviewItemTask = preProcessTask
      .next(mcpTask)
      .next(postProcessTask);

    // Retry configuration is already added in each specific task implementation above
    // No need for additional retry configuration here

    processItemsMap.itemProcessor(processReviewItemTask);

    // 審査結果を集計するLambda
    const finalizeReviewTask = new tasks.LambdaInvoke(this, "FinalizeReview", {
      lambdaFunction: this.reviewLambda,
      payload: sfn.TaskInput.fromObject({
        action: "finalizeReview",
        reviewJobId: sfn.JsonPath.stringAt("$.reviewJobId"),
        processedItems: sfn.JsonPath.stringAt("$.processedItems"),
      }),
      outputPath: "$.Payload",
    });

    // エラーハンドリングLambda
    const handleErrorTask = new tasks.LambdaInvoke(this, "HandleError", {
      lambdaFunction: this.reviewLambda,
      payload: sfn.TaskInput.fromObject({
        action: "handleReviewError",
        reviewJobId: sfn.JsonPath.stringAt("$$.Execution.Input.reviewJobId"),
        error: sfn.JsonPath.stringAt("$.error.Error"),
        cause: sfn.JsonPath.stringAt("$.error.Cause"),
      }),
      resultPath: "$.errorResult",
    });

    // エラーハンドリングの設定
    prepareReviewTask.addCatch(handleErrorTask, {
      errors: ["States.ALL"],
      resultPath: "$.error",
    });
    processItemsMap.addCatch(handleErrorTask, {
      errors: ["States.ALL"],
      resultPath: "$.error",
    });
    finalizeReviewTask.addCatch(handleErrorTask, {
      errors: ["States.ALL"],
      resultPath: "$.error",
    });

    // ワークフロー定義
    const definition = prepareReviewTask
      .next(processItemsMap)
      .next(finalizeReviewTask);

    // IAMロールの作成
    const stateMachineRole = new iam.Role(this, "StateMachineRole", {
      assumedBy: new iam.ServicePrincipal("states.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaRole"
        ),
      ],
    });

    // Bedrockへのアクセス権限を追加
    stateMachineRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["*"],
      })
    );

    // S3バケットへのアクセス権限を追加
    props.documentBucket.grantReadWrite(stateMachineRole);
    props.tempBucket.grantReadWrite(stateMachineRole);

    // ログ設定
    const logGroup = new logs.LogGroup(this, "StateMachineLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // ステートマシンの作成
    this.stateMachine = new sfn.StateMachine(this, "ReviewProcessingWorkflow", {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      role: stateMachineRole,
      timeout: cdk.Duration.hours(2),
      tracingEnabled: true,
      logs: {
        destination: logGroup,
        level: logLevel,
        includeExecutionData: true,
      },
    });
  }
}
