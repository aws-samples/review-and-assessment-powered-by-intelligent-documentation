import { CfnOutput, Names, Stack } from "aws-cdk-lib";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";
import { join } from "path";
import {
  Effect,
  IGrantable,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { CfnMemory, CfnRuntime } from "aws-cdk-lib/aws-bedrockagentcore";

import * as s3 from "aws-cdk-lib/aws-s3";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export interface AgentProps {
  documentBucket: s3.IBucket;
  tempBucket: s3.IBucket;
  /**
   * 既定の AI モデル ID。ドキュメント用・画像用の
   * 2 つを 1 つに統合した（AgentCore Runtime へは互換のため両 env キーに供給）。
   */
  defaultModelId: string;
  enableCitations: boolean;
  enableCodeInterpreter: boolean;
  /**
   * When set (closed-network mode), the AgentCore runtime runs in the VPC
   * (networkMode: VPC) using these isolated subnets + the agent security group.
   * When omitted, the runtime uses networkMode: PUBLIC (standard mode).
   */
  vpc?: ec2.IVpc;
  /**
   * Subnet selection for the VPC-mode runtime. Required when `vpc` is set.
   */
  subnetSelection?: ec2.SubnetSelection;
}

export class Agent extends Construct {
  public runtimeArn: string;
  /**
   * Security group attached to the runtime in VPC mode (undefined in PUBLIC mode).
   */
  public securityGroup?: ec2.SecurityGroup;
  constructor(scope: Construct, id: string, props: AgentProps) {
    super(scope, id);

    const {
      documentBucket,
      tempBucket,
      defaultModelId,
      enableCitations,
      enableCodeInterpreter,
      vpc,
      subnetSelection,
    } = props;

    const image = new DockerImageAsset(this, "Image", {
      directory: join(__dirname, "../../../review-item-processor"),
      platform: Platform.LINUX_ARM64,
      file: "Dockerfile",
    });
    const role = new Role(this, "Role", {
      assumedBy: new ServicePrincipal("bedrock-agentcore.amazonaws.com"),
    });
    image.repository.grantPull(role);

    // S3 permissions
    documentBucket.grantReadWrite(role);
    tempBucket.grantReadWrite(role);

    const region = Stack.of(this).region;
    const accountId = Stack.of(this).account;
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["logs:DescribeLogStreams", "logs:CreateLogGroup"],
        resources: [
          `arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*`,
        ],
      }),
    );

    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["logs:DescribeLogGroups"],
        resources: [`arn:aws:logs:${region}:${accountId}:log-group:*`],
      }),
    );

    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
        resources: [
          `arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*`,
        ],
      }),
    );

    role.addToPolicy(
      new PolicyStatement({
        sid: "ECRTokenAccess",
        effect: Effect.ALLOW,
        actions: ["ecr:GetAuthorizationToken"],
        resources: ["*"],
      }),
    );

    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
        ],
        resources: ["*"],
      }),
    );

    role.addToPolicy(
      new PolicyStatement({
        sid: "TransactionSearchPermissions",
        effect: Effect.ALLOW,
        actions: [
          "xray:GetTraceSegmentDestination",
          "xray:UpdateTraceSegmentDestination",
          "xray:GetIndexingRules",
          "xray:UpdateIndexingRule",
        ],
        resources: ["*"],
      }),
    );

    role.addToPolicy(
      new PolicyStatement({
        sid: "TransactionSearchLogGroups",
        effect: Effect.ALLOW,
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutRetentionPolicy",
        ],
        resources: [
          `arn:aws:logs:*:${accountId}:log-group:/aws/application-signals/data:*`,
          `arn:aws:logs:*:${accountId}:log-group:aws/spans:*`,
        ],
      }),
    );

    role.addToPolicy(
      new PolicyStatement({
        sid: "ApplicationSignalsPermissions",
        effect: Effect.ALLOW,
        actions: ["application-signals:StartDiscovery"],
        resources: ["*"],
      }),
    );

    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["cloudwatch:PutMetricData"],
        resources: ["*"],
        conditions: {
          StringEquals: {
            "cloudwatch:namespace": "bedrock-agentcore",
          },
        },
      }),
    );

    role.addToPolicy(
      new PolicyStatement({
        sid: "GetAgentAccessToken",
        effect: Effect.ALLOW,
        actions: [
          "bedrock-agentcore:GetWorkloadAccessToken",
          "bedrock-agentcore:GetWorkloadAccessTokenForJWT",
          "bedrock-agentcore:GetWorkloadAccessTokenForUserId",
        ],
        resources: [
          `arn:aws:bedrock-agentcore:${region}:${accountId}:workload-identity-directory/default`,
          `arn:aws:bedrock-agentcore:${region}:${accountId}:workload-identity-directory/default/workload-identity/agentName-*`,
        ],
      }),
    );

    role.addToPolicy(
      new PolicyStatement({
        sid: "BedrockModelInvocation",
        effect: Effect.ALLOW,
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: [
          "arn:aws:bedrock:*::foundation-model/*",
          `arn:aws:bedrock:${region}:${accountId}:*`,
          `arn:aws:bedrock:*:${accountId}:inference-profile/*`,
        ],
      }),
    );

    // Knowledge Base（RAG）ツール向けの bedrock:Retrieve 権限。
    // Knowledge Base の設定は Web UI の「ツール設定」画面から行い、本アプリケーションと
    // 同一の AWS アカウント・同一リージョンに存在する Knowledge Base を利用します。
    // そのため Retrieve は当該アカウント・当該リージョンの knowledge-base/* に限定して
    // 許可し、他アカウント・他リージョンの Knowledge Base は対象外とします。
    role.addToPolicy(
      new PolicyStatement({
        sid: "BedrockKnowledgeBaseAccess",
        effect: Effect.ALLOW,
        actions: ["bedrock:Retrieve"],
        resources: [`arn:aws:bedrock:${region}:${accountId}:knowledge-base/*`],
      }),
    );

    role.addToPolicy(
      new PolicyStatement({
        sid: "InvokeGatewayForAwsSecurityAudit",
        effect: Effect.ALLOW,
        actions: ["bedrock-agentcore:InvokeGateway"],
        resources: [
          `arn:aws:bedrock-agentcore:${region}:${accountId}:gateway/*`,
        ],
      }),
    );

    // Note: currently memory is not used
    const memory = new CfnMemory(this, "Memory", {
      name: Names.uniqueResourceName(this, { maxLength: 40 }),
      eventExpiryDuration: 30,
      memoryStrategies: [
        {
          userPreferenceMemoryStrategy: {
            name: Names.uniqueResourceName(this, { maxLength: 23 }),
            namespaces: ["/preferences/{actorId}"],
          },
        },
      ],
    });

    role.addToPolicy(
      new PolicyStatement({
        sid: "AgentCoreMemoryPermissions",
        effect: Effect.ALLOW,
        actions: [
          "bedrock-agentcore:CreateEvent",
          "bedrock-agentcore:ListEvents",
          "bedrock-agentcore:RetrieveMemories",
          "bedrock-agentcore:RetrieveMemoryRecords",
        ],
        resources: [memory.attrMemoryArn],
      }),
    );

    role.addToPolicy(
      new PolicyStatement({
        sid: "AgentCoreCodeInterpreterPermissions",
        effect: Effect.ALLOW,
        actions: [
          "bedrock-agentcore:CreateCodeInterpreter",
          "bedrock-agentcore:StartCodeInterpreterSession",
          "bedrock-agentcore:InvokeCodeInterpreter",
          "bedrock-agentcore:StopCodeInterpreterSession",
          "bedrock-agentcore:DeleteCodeInterpreter",
          "bedrock-agentcore:ListCodeInterpreters",
          "bedrock-agentcore:GetCodeInterpreter",
          "bedrock-agentcore:GetCodeInterpreterSession",
          "bedrock-agentcore:ListCodeInterpreterSessions",
        ],
        resources: [
          `arn:aws:bedrock-agentcore:${region}:${accountId}:code-interpreter/*`,
          `arn:aws:bedrock-agentcore:${region}:aws:code-interpreter/*`,
        ],
      }),
    );

    // Network mode: VPC (closed mode) when a vpc is provided, otherwise PUBLIC.
    // In VPC mode the runtime reaches Bedrock/S3/logs/etc. via the VPC endpoints.
    let networkConfiguration: CfnRuntime.NetworkConfigurationProperty;
    if (vpc) {
      if (!subnetSelection) {
        throw new Error(
          "Agent: subnetSelection is required when vpc is provided (VPC network mode)",
        );
      }

      const agentSg = new ec2.SecurityGroup(this, "RuntimeSecurityGroup", {
        vpc,
        description: "Security group for the AgentCore runtime (VPC mode)",
        allowAllOutbound: true,
      });
      this.securityGroup = agentSg;

      const selectedSubnets = vpc.selectSubnets(subnetSelection);
      networkConfiguration = {
        networkMode: "VPC",
        networkModeConfig: {
          subnets: selectedSubnets.subnetIds,
          securityGroups: [agentSg.securityGroupId],
        },
      };
    } else {
      networkConfiguration = { networkMode: "PUBLIC" };
    }

    const runtime = new CfnRuntime(this, "Runtime", {
      agentRuntimeName: Names.uniqueResourceName(this, { maxLength: 40 }),
      agentRuntimeArtifact: {
        containerConfiguration: {
          containerUri: image.imageUri,
        },
      },
      networkConfiguration,
      roleArn: role.roleArn,
      protocolConfiguration: "HTTP",
      // アイドルセッションの保持時間は 900 秒（サービス既定値）を明示的に固定する。
      //
      // 【重要】この値を安易に短縮してはならない。過去に 120 秒へ短縮した際、
      // 処理に 120 秒以上かかる正当な審査項目（MCP ツールを多数呼ぶ項目など）の
      // microVM が「同期 invocation の処理中にもかかわらず」タイムアウトで強制
      // 終了され、呼び出し元には RuntimeClientError
      // （"Runtime initialization time exceeded. Please make sure that
      // initialization completes in <値>s."）が返り続けてジョブが失敗した。
      // 公式ドキュメントには「同期呼び出し中はアクティブとして自動追跡される」
      // 旨の記述があるが、実測ではアイドルタイムアウト値がそのまま処理中の
      // セッションの kill タイマーとして働く（/ping が Healthy を返し続ける限り
      // アイドル扱いになるため）。
      // 審査項目の実行時間上限は invoke-agent Lambda のタイムアウト（15 分 =
      // 900 秒）なので、900 秒であればタイムアウトより先にセッションが刈られる
      // ことはない。アイドル尾部のメモリ課金（~$0.06/13 項目ジョブ）は許容する。
      // 短縮したい場合は、処理中に /ping を HealthyBusy にする対応
      // （SDK の add_async_task / @app.ping、公式の長時間処理ガイド参照）と
      // セットで、実環境検証を経てから行うこと。HealthyBusy 化は complete 漏れ・
      // 暴走ループ時に maxLifetime（既定 8 時間）まで課金が続くリスクを伴う。
      //
      // Pin the idle session retention to 900s (the service default),
      // explicitly.
      //
      // IMPORTANT: do not casually lower this value. When it was shortened to
      // 120s, microVMs of legitimately long-running review items (e.g. items
      // making many MCP tool calls, taking over 120s) were force-terminated
      // MID-PROCESSING of a synchronous invocation, surfacing to the caller
      // as persistent RuntimeClientError ("Runtime initialization time
      // exceeded. Please make sure that initialization completes in <N>s.")
      // and failing the job. Although the docs state sync invocations are
      // automatically tracked as activity, observed behavior is that the
      // idle timeout acts as a kill timer even while processing (the /ping
      // keeps reporting plain "Healthy", so the session looks idle).
      // Item execution is capped by the invoke-agent Lambda timeout (15 min
      // = 900s), so at 900s the session can never be reaped before the item
      // itself times out. The idle-tail memory cost (~$0.06 per 13-item job)
      // is accepted. If shortening is ever needed, pair it with HealthyBusy
      // ping signaling during processing (SDK add_async_task / @app.ping per
      // the official long-running-agents guide), validate in a real
      // environment first, and note that busy signaling risks billing until
      // maxLifetime (default 8h) if completion is ever missed or a task
      // loops forever.
      lifecycleConfiguration: {
        idleRuntimeSessionTimeout: 900,
      },
      environmentVariables: {
        DOCUMENT_BUCKET: documentBucket.bucketName,
        TEMP_BUCKET: tempBucket.bucketName,
        // env キー（DOCUMENT_PROCESSING_MODEL_ID /
        // IMAGE_REVIEW_MODEL_ID）は review-item-processor（Python）の互換のため
        // 維持し、双方に統合後の単一 defaultModelId を供給する。
        DOCUMENT_PROCESSING_MODEL_ID: defaultModelId,
        IMAGE_REVIEW_MODEL_ID: defaultModelId,
        ENABLE_CITATIONS: enableCitations.toString(),
        ENABLE_CODE_INTERPRETER: enableCodeInterpreter.toString(),
        MEMORY_ID: memory.attrMemoryId,
        AWS_REGION: region,
        // review-item-processor のログレベルを既定 INFO に
        // 固定する。logger.py が未設定時 INFO にフォールバックするため必須ではないが、運用で
        // 一時的に DEBUG へ切り替え可能にするため明示する。文書内容を含みうる debug ログを
        // 本番で出力させないことが目的。
        LOG_LEVEL: "INFO",
      },
    });
    this.runtimeArn = runtime.attrAgentRuntimeArn;
    runtime.node.addDependency(role);
    runtime.node.addDependency(memory);

    new CfnOutput(this, "AgentCoreRuntimeArn", { value: this.runtimeArn });
    new CfnOutput(this, "AgentCoreMemoryId", { value: memory.attrMemoryId });
  }

  public grantInvoke(grantee: IGrantable) {
    grantee.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["bedrock-agentcore:InvokeAgentRuntime"],
        resources: [
          this.runtimeArn,
          `${this.runtimeArn}/runtime-endpoint/DEFAULT`,
        ],
      }),
    );
  }
}
