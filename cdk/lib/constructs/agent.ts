import { CfnOutput, Names, Size, Stack } from "aws-cdk-lib";
import { ITableV2 } from "aws-cdk-lib/aws-dynamodb";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";
import { readFileSync } from "fs";
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

export interface AgentProps {
  bedrockRegion: string;
  documentBucket: s3.IBucket;
  tempBucket: s3.IBucket;
  documentProcessingModelId: string;
  imageReviewModelId: string;
  enableCitations: boolean;
}

export class Agent extends Construct {
  public runtimeArn: string;
  constructor(scope: Construct, id: string, props: AgentProps) {
    super(scope, id);

    const {
      bedrockRegion,
      documentBucket,
      tempBucket,
      documentProcessingModelId,
      imageReviewModelId,
      enableCitations,
    } = props;

    const image = new DockerImageAsset(this, "Image", {
      directory: join(
        __dirname,
        "../../../backend/src/review-workflow/review-item-processor"
      ),
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
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["logs:DescribeLogGroups"],
        resources: [`arn:aws:logs:${region}:${accountId}:log-group:*`],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
        resources: [
          `arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*`,
        ],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        sid: "ECRTokenAccess",
        effect: Effect.ALLOW,
        actions: ["ecr:GetAuthorizationToken"],
        resources: ["*"],
      })
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
      })
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
      })
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
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        sid: "ApplicationSignalsPermissions",
        effect: Effect.ALLOW,
        actions: ["application-signals:StartDiscovery"],
        resources: ["*"],
      })
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
      })
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
      })
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
      })
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
      })
    );

    const runtime = new CfnRuntime(this, "Runtime", {
      agentRuntimeName: Names.uniqueResourceName(this, { maxLength: 40 }),
      agentRuntimeArtifact: {
        containerConfiguration: {
          containerUri: image.imageUri,
        },
      },
      networkConfiguration: {
        networkMode: "PUBLIC",
      },
      roleArn: role.roleArn,
      protocolConfiguration: "HTTP",
      environmentVariables: {
        BEDROCK_REGION: bedrockRegion,
        DOCUMENT_BUCKET: documentBucket.bucketName,
        TEMP_BUCKET: tempBucket.bucketName,
        DOCUMENT_PROCESSING_MODEL_ID: documentProcessingModelId,
        IMAGE_REVIEW_MODEL_ID: imageReviewModelId,
        ENABLE_CITATIONS: enableCitations.toString(),
        MEMORY_ID: memory.attrMemoryId,
        AGENT_REGION: region,
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
      })
    );
  }
}
