import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as path from "path";
import { Construct } from "constructs";
import { DockerPrismaFunction } from "./docker-prisma-function";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import { DatabaseConnectionProps } from "./database";

/**
 * ドキュメント処理ワークフローのプロパティ
 */
export interface ChecklistProcessorProps {
  /**
   * ドキュメントを保存するS3バケット
   */
  documentBucket: s3.IBucket;

  /**
   * Lambda関数を配置するVPC
   */
  vpc: ec2.IVpc;

  databaseConnection: DatabaseConnectionProps;

  /**
   * 中規模ドキュメントのしきい値（ページ数）
   * このページ数以上の場合は分散Map Stateを使用
   * @default 40
   */
  mediumDocThreshold?: number;

  /**
   * 大規模ドキュメントのしきい値（ページ数）
   * このページ数以上の場合はBatch APIを使用
   * @default 100
   */
  largeDocThreshold?: number;

  /**
   * インラインMap Stateの最大並行実行数
   * @default 10
   */
  inlineMapConcurrency?: number;

  /**
   * 分散Map Stateの最大並行実行数
   * @default 20
   */
  distributedMapConcurrency?: number;

  /**
   * ステートマシンの実行ログレベル
   * @default ERROR
   */
  logLevel?: sfn.LogLevel;

  /**
   * ドキュメント処理に使用するAIモデルID
   * @default "us.anthropic.claude-3-7-sonnet-20250219-v1:0"
   */
  documentProcessingModelId: string;

  /**
   * Amazon Bedrockを利用するリージョン
   * @default "us-west-2"
   */
  bedrockRegion: string;
}

/**
 * ドキュメント処理ワークフローを実装するCDK Construct
 */
export class ChecklistProcessor extends Construct {
  /**
   * ステートマシン
   */
  public readonly stateMachine: sfn.StateMachine;

  /**
   * ドキュメント処理用Lambda関数
   */
  public readonly documentLambda: lambda.Function;

  /**
   * Lambda関数用セキュリティグループ
   */
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: ChecklistProcessorProps) {
    super(scope, id);

    // デフォルト値の設定
    const mediumDocThreshold = props.mediumDocThreshold || 40;
    const largeDocThreshold = props.largeDocThreshold || 100;
    // Use the value provided in props or default to 1
    const inlineMapConcurrency = props.inlineMapConcurrency || 1;
    const logLevel = props.logLevel || sfn.LogLevel.ERROR;

    // セキュリティグループの作成
    this.securityGroup = new ec2.SecurityGroup(
      this,
      "DocumentProcessorSecurityGroup",
      {
        vpc: props.vpc,
        description: "Security group for Document Processor Lambda function",
        allowAllOutbound: true,
      }
    );

    this.documentLambda = new DockerPrismaFunction(
      this,
      "DocumentProcessorFunction",
      {
        code: lambda.DockerImageCode.fromImageAsset(
          path.join(__dirname, "../../../backend/"),
          {
            file: "Dockerfile.prisma.lambda",
            platform: Platform.LINUX_ARM64,
            cmd: ["dist/checklist-workflow/index.handler"],
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
          BEDROCK_REGION: props.bedrockRegion,
          DOCUMENT_PROCESSING_MODEL_ID: props.documentProcessingModelId,
        },
        securityGroups: [this.securityGroup],
        database: props.databaseConnection,
        architecture: cdk.aws_lambda.Architecture.ARM_64,
      }
    );

    // Lambda関数にS3バケットへのアクセス権限を付与
    props.documentBucket.grantReadWrite(this.documentLambda);

    // Lambda関数にBedrockへのアクセス権限を付与
    this.documentLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:CreateModelInvocationJob",
          "bedrock:GetModelInvocationJob",
          "bedrock:StopModelInvocationJob",
        ],
        resources: ["*"],
      })
    );

    // ドキュメント処理Lambda (ファイル形式判定、ページ分割など)
    const documentProcessorTask = new tasks.LambdaInvoke(
      this,
      "ProcessDocument",
      {
        lambdaFunction: this.documentLambda,
        payload: sfn.TaskInput.fromObject({
          action: "processDocument",
          documentId: sfn.JsonPath.stringAt("$.documentId"),
          fileName: sfn.JsonPath.stringAt("$.fileName"),
          checkListSetId: sfn.JsonPath.stringAt("$.checkListSetId"),
        }),
        // outputPath: "$.Payload",
        resultPath: "$.processingResult",
      }
    );

    // LLM処理用のLambda Invoke Task
    const processWithLLMTask = new tasks.LambdaInvoke(this, "ProcessWithLLM", {
      lambdaFunction: this.documentLambda,
      payload: sfn.TaskInput.fromObject({
        action: "processWithLLM",
        documentId: sfn.JsonPath.stringAt("$.documentId"),
        pageNumber: sfn.JsonPath.stringAt("$.pageNumber"),
        userId: sfn.JsonPath.stringAt("$.userId"), // Pass userId from the input (was $$.Execution.Input.userId)
      }),
      payloadResponseOnly: true,
      outputPath: "$",
      resultPath: "$",
    }).addRetry({
      errors: [
        "Lambda.ServiceException",
        "Lambda.AWSLambdaException",
        "Lambda.SdkClientException",
        "Error",
      ],
      interval: cdk.Duration.seconds(2),
      backoffRate: 2,
      maxAttempts: 5,
    });

    // エラーハンドリングLambda
    const handleErrorTask = new tasks.LambdaInvoke(this, "HandleError", {
      lambdaFunction: this.documentLambda,
      payload: sfn.TaskInput.fromObject({
        action: "handleError",
        documentId: sfn.JsonPath.stringAt("$.documentId"),
        error: sfn.JsonPath.stringAt("$.error"),
      }),
      outputPath: "$.Payload",
    });

    // パラレル処理エラーハンドリングLambda
    const handleParallelErrorTask = new tasks.LambdaInvoke(
      this,
      "HandleParallelError",
      {
        lambdaFunction: this.documentLambda,
        payload: sfn.TaskInput.fromObject({
          action: "handleError",
          documentId: sfn.JsonPath.stringAt("$.documentId"),
          pageNumber: sfn.JsonPath.stringAt("$.pageNumber"),
          error: sfn.JsonPath.stringAt("$.error"),
        }),
        outputPath: "$.Payload",
      }
    );

    // LLM処理にエラーハンドリングを追加
    processWithLLMTask.addCatch(handleParallelErrorTask);

    // 各ページの処理フロー: LLM処理のみに簡略化
    const processPageFlow = processWithLLMTask;

    // インラインMap State
    const inlineMapState = new sfn.Map(this, "ProcessAllPagesInline", {
      maxConcurrency: inlineMapConcurrency,
      itemsPath: sfn.JsonPath.stringAt("$.processingResult.Payload.pages"),
      resultPath: "$.processedPages",
      itemSelector: {
        pageNumber: sfn.JsonPath.stringAt("$$.Map.Item.Value.pageNumber"),
        documentId: sfn.JsonPath.stringAt(
          "$.processingResult.Payload.documentId"
        ),
        userId: sfn.JsonPath.stringAt("$.userId"), // Pass userId from the input
      },
      // resultSelector は Map の結果に対して適用されるので、ここでは不要です
    });
    inlineMapState.itemProcessor(processPageFlow);

    const processMediumDocPass = new sfn.Pass(this, "ProcessMediumDocPass", {
      parameters: {
        status: "Processing medium document with distributed map (simplified)",
        documentId: sfn.JsonPath.stringAt(
          "$.processingResult.Payload.documentId"
        ),
        processedPages: [],
        checkListSetId: sfn.JsonPath.stringAt("$.checkListSetId"), // 追加
      },
      resultPath: "$.processedPages",
    });

    const processLargeDocPass = new sfn.Pass(this, "ProcessLargeDocPass", {
      parameters: {
        status: "Processing large document with Bedrock Batch (simplified)",
        documentId: sfn.JsonPath.stringAt(
          "$.processingResult.Payload.documentId"
        ),
        processedPages: [],
        checkListSetId: sfn.JsonPath.stringAt("$.checkListSetId"), // 追加
      },
      resultPath: "$.processedPages",
    });

    // 結果統合Lambda
    const aggregateResultTask = new tasks.LambdaInvoke(
      this,
      "AggregateResults",
      {
        lambdaFunction: this.documentLambda,
        payload: sfn.TaskInput.fromObject({
          action: "aggregatePageResults",
          documentId: sfn.JsonPath.stringAt("$.documentId"),
          processedPages: sfn.JsonPath.stringAt("$.processedPages"),
          checkListSetId: sfn.JsonPath.stringAt("$.checkListSetId"),
        }),
        // outputPath: "$.Payload",
        resultPath: "$.aggregationResult",
      }
    );

    const storeToDbTask = new tasks.LambdaInvoke(this, "StoreToDb", {
      lambdaFunction: this.documentLambda,
      payload: sfn.TaskInput.fromObject({
        action: "storeToDb",
        documentId: sfn.JsonPath.stringAt("$.documentId"),
        checkListSetId: sfn.JsonPath.stringAt("$.checkListSetId"),
      }),
      // outputPath: "$.Payload",
      resultPath: "$.dbStoreResult",
    }).addRetry({
      errors: [
        "Lambda.ServiceException",
        "Lambda.AWSLambdaException",
        "Lambda.SdkClientException",
        "Error",
      ],
      interval: cdk.Duration.seconds(2),
      backoffRate: 2,
      maxAttempts: 5,
    });

    const detectAmbiguityTask = new tasks.LambdaInvoke(this, "DetectAmbiguity", {
      lambdaFunction: this.documentLambda,
      payload: sfn.TaskInput.fromObject({
        action: "detectAmbiguity",
        checkListSetId: sfn.JsonPath.stringAt("$.checkListSetId"),
        userId: sfn.JsonPath.stringAt("$.userId"),
      }),
      resultPath: "$.ambiguityResult",
    });

    // ページ数に基づく処理方法の選択
    const pageCountChoice = new sfn.Choice(this, "CheckPageCount")
      .when(
        sfn.Condition.numberGreaterThanEquals(
          "$.processingResult.Payload.pageCount",
          largeDocThreshold
        ),
        processLargeDocPass
      )
      .when(
        sfn.Condition.numberGreaterThanEquals(
          "$.processingResult.Payload.pageCount",
          mediumDocThreshold
        ),
        processMediumDocPass
      )
      .otherwise(inlineMapState);

    // ワークフロー定義
    const definition = documentProcessorTask.next(pageCountChoice);

    // 各処理パスから結合タスクへの接続
    inlineMapState.next(aggregateResultTask);
    processMediumDocPass.next(aggregateResultTask);
    processLargeDocPass.next(aggregateResultTask);

    aggregateResultTask.next(storeToDbTask);
    // storeToDbTask is not the final step because detectAmbiguityTask reuses existing API implementation
    // and is designed to be self-contained, allowing it to run independently after data storage
    storeToDbTask.next(detectAmbiguityTask);

    // エラーハンドリングの設定
    documentProcessorTask.addCatch(handleErrorTask);
    aggregateResultTask.addCatch(handleErrorTask);
    storeToDbTask.addCatch(handleErrorTask);
    detectAmbiguityTask.addCatch(handleErrorTask);

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
        actions: [
          "bedrock:InvokeModel",
          "bedrock:CreateModelInvocationJob",
          "bedrock:GetModelInvocationJob",
          "bedrock:StopModelInvocationJob",
        ],
        resources: ["*"],
      })
    );

    // S3バケットへのアクセス権限を追加
    props.documentBucket.grantReadWrite(stateMachineRole);

    // ログ設定
    const logGroup = new logs.LogGroup(this, "StateMachineLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // ステートマシンの作成
    this.stateMachine = new sfn.StateMachine(
      this,
      "DocumentProcessingWorkflow",
      {
        definitionBody: sfn.DefinitionBody.fromChainable(definition),
        role: stateMachineRole,
        timeout: cdk.Duration.hours(24),
        tracingEnabled: true,
        logs: {
          destination: logGroup,
          level: logLevel,
          includeExecutionData: true,
        },
      }
    );

    // エラーハンドリングの設定
    documentProcessorTask.addCatch(handleErrorTask);
    aggregateResultTask.addCatch(handleErrorTask);
  }
}
