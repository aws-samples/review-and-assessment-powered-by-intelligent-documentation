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
import { CfnRuntime } from "aws-cdk-lib/aws-bedrockagentcore";
import * as s3 from "aws-cdk-lib/aws-s3";

export interface NextActionAgentProps {
  bedrockRegion: string;
  tempBucket: s3.IBucket;
  nextActionModelId: string;
  enableCodeInterpreter: boolean;
}

/**
 * NextActionAgent - AgentCore Runtime for generating next actions
 *
 * This construct creates an AgentCore Runtime that uses the next-action-generator
 * Python Lambda to generate actionable next steps based on review results.
 */
export class NextActionAgent extends Construct {
  public runtimeArn: string;

  constructor(scope: Construct, id: string, props: NextActionAgentProps) {
    super(scope, id);

    const { bedrockRegion, tempBucket, nextActionModelId, enableCodeInterpreter } =
      props;

    // Build Docker image from next-action-generator directory
    const image = new DockerImageAsset(this, "Image", {
      directory: join(__dirname, "../../../next-action-generator"),
      platform: Platform.LINUX_ARM64,
      file: "Dockerfile",
    });

    // Create IAM role for AgentCore Runtime
    const role = new Role(this, "Role", {
      assumedBy: new ServicePrincipal("bedrock-agentcore.amazonaws.com"),
    });
    image.repository.grantPull(role);

    // S3 permissions for temp bucket
    tempBucket.grantReadWrite(role);

    const region = Stack.of(this).region;
    const accountId = Stack.of(this).account;

    // CloudWatch Logs permissions
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

    // ECR permissions
    role.addToPolicy(
      new PolicyStatement({
        sid: "ECRTokenAccess",
        effect: Effect.ALLOW,
        actions: ["ecr:GetAuthorizationToken"],
        resources: ["*"],
      })
    );

    // X-Ray permissions
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

    // CloudWatch Metrics permissions
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

    // AgentCore workload identity permissions
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

    // Bedrock model invocation permissions
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

    // Bedrock Knowledge Base access (for tool configuration)
    role.addToPolicy(
      new PolicyStatement({
        sid: "BedrockKnowledgeBaseAccess",
        effect: Effect.ALLOW,
        actions: ["bedrock:Retrieve"],
        resources: [`arn:aws:bedrock:${region}:${accountId}:knowledge-base/*`],
      })
    );

    // Gateway access for MCP
    role.addToPolicy(
      new PolicyStatement({
        sid: "InvokeGatewayForMCP",
        effect: Effect.ALLOW,
        actions: ["bedrock-agentcore:InvokeGateway"],
        resources: [
          `arn:aws:bedrock-agentcore:${region}:${accountId}:gateway/*`,
        ],
      })
    );

    // Code Interpreter permissions (if enabled)
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
      })
    );

    // Create AgentCore Runtime
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
        TEMP_BUCKET: tempBucket.bucketName,
        NEXT_ACTION_MODEL_ID: nextActionModelId,
        ENABLE_CODE_INTERPRETER: enableCodeInterpreter.toString(),
        AWS_REGION: region,
      },
    });

    this.runtimeArn = runtime.attrAgentRuntimeArn;
    runtime.node.addDependency(role);

    new CfnOutput(this, "NextActionAgentRuntimeArn", { value: this.runtimeArn });
  }

  /**
   * Grant invoke permissions to a grantee
   */
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
