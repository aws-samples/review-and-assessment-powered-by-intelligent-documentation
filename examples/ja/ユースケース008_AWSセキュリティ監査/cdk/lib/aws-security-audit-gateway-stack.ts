import * as cdk from "aws-cdk-lib";
import * as agentcore from "aws-cdk-lib/aws-bedrockagentcore";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as path from "path";
import * as fs from "fs";

export class AwsSecurityAuditGatewayStack extends cdk.Stack {
  public readonly gatewayEndpoint: string;
  public readonly mcpConfigOutput: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const UNIQUE_ID = "uc008";

    const region = cdk.Stack.of(this).region;
    const accountId = cdk.Stack.of(this).account;

    // =================================================================
    // SECTION 1: Gateway IAM Role
    // =================================================================

    const gatewayRole = new iam.Role(this, "GatewayRole", {
      assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
      description: "IAM role for UC008 Gateway to invoke Lambda function",
    });

    gatewayRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "GetGateway",
        effect: iam.Effect.ALLOW,
        actions: ["bedrock-agentcore:GetGateway"],
        resources: [
          `arn:aws:bedrock-agentcore:${region}:${accountId}:gateway/*`,
        ],
      }),
    );

    gatewayRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "InvokeLambda",
        effect: iam.Effect.ALLOW,
        actions: ["lambda:InvokeFunction"],
        resources: [`arn:aws:lambda:${region}:${accountId}:function:*`],
      }),
    );

    // =================================================================
    // SECTION 2: Lambda Function (Python Docker Image)
    // =================================================================

    const lambdaFunction = new lambda.DockerImageFunction(
      this,
      "McpProxyTool",
      {
        code: lambda.DockerImageCode.fromImageAsset(
          path.join(__dirname, "lambda-tool"),
        ),
        timeout: cdk.Duration.seconds(120),
        memorySize: 1024,
        architecture: lambda.Architecture.ARM_64,
        description: "MCP proxy for aws-api-mcp-server (UC008 Gateway)",
        environment: {
          HOME: "/tmp",
          UV_CACHE_DIR: "/tmp/.uv",
          UV_TOOL_DIR: "/tmp/.uv/tools",
          LOG_LEVEL: "DEBUG",
        },
      },
    );

    // AWS Security Audit permissions
    lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        sid: "SecurityAuditReadAccess",
        effect: iam.Effect.ALLOW,
        actions: [
          // RDS
          "rds:Describe*",
          // S3
          "s3:Get*",
          "s3:List*",
          // IAM
          "iam:Get*",
          "iam:List*",
          "iam:GenerateCredentialReport",
          // CloudTrail
          "cloudtrail:Describe*",
          "cloudtrail:Get*",
          "cloudtrail:List*",
          "cloudtrail:LookupEvents",
          // EC2/VPC
          "ec2:Describe*",
          // Config
          "config:Describe*",
          "config:Get*",
          "config:List*",
          // GuardDuty
          "guardduty:Get*",
          "guardduty:List*",
          // CloudWatch Logs
          "logs:Describe*",
          "logs:Get*",
          "logs:FilterLogEvents",
          // SNS/SQS
          "sns:Get*",
          "sns:List*",
          "sqs:Get*",
          "sqs:List*",
        ],
        resources: ["*"],
      }),
    );

    // =================================================================
    // SECTION 3: L1 CfnGateway (IAM Auth)
    // =================================================================
    //
    // AgentCore Gateway Authentication Options:
    //
    // 1. AWS_IAM (selected here)
    //    - Uses SigV4 signature-based authentication
    //    - No additional token management required
    //    - Gateway→Lambda calls are automatically authenticated via IAM
    //    - MCP clients connecting to this Gateway MUST support SigV4:
    //      * Use mcp-proxy-for-aws (handles SigV4 signing automatically)
    //      * Or implement custom SigV4 signing in HTTP requests
    //      * Strands Agent SDK's streamablehttp_client does NOT support SigV4
    //
    // 2. CUSTOM_JWT (alternative, not used here)
    //    - OAuth 2.0 / OIDC token-based authentication
    //    - Allows direct HTTP connections from MCP clients
    //    - Requires Cognito or external identity provider setup
    //    - Bearer token in Authorization header
    // =================================================================

    const gatewayName = `uc8-gateway-${UNIQUE_ID}-lambda`;

    const gateway = new agentcore.CfnGateway(this, "Gateway", {
      name: gatewayName,
      roleArn: gatewayRole.roleArn,
      authorizerType: "AWS_IAM",
      protocolType: "MCP",
      protocolConfiguration: {
        mcp: {
          instructions:
            "Gateway for AWS Security Audit using aws-api-mcp-server",
          searchType: "SEMANTIC",
        },
      },
    } as any);

    // =================================================================
    // SECTION 4: Gateway Target (Lambda + Tool Schema)
    // =================================================================

    // tool-schema.json
    const schemaPath = path.join(__dirname, "lambda-tool/tool-schema.json");
    const schemaContent = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

    // Extract Gateway ID
    const gatewayIdToken = cdk.Fn.select(
      1,
      cdk.Fn.split("/", gateway.attrGatewayArn),
    );

    // Create a Gateway Target
    const gatewayTarget = new agentcore.CfnGatewayTarget(
      this,
      "GatewayTarget",
      {
        name: "aws-api-mcp-server",
        gatewayIdentifier: gatewayIdToken,
        credentialProviderConfigurations: [
          {
            credentialProviderType: "GATEWAY_IAM_ROLE",
          },
        ],
        targetConfiguration: {
          mcp: {
            lambda: {
              lambdaArn: lambdaFunction.functionArn,
              toolSchema: {
                inlinePayload: schemaContent.tools,
              },
            },
          },
        },
      } as any,
    );

    // =================================================================
    // SECTION 5: CloudFormation Outputs
    // =================================================================

    this.gatewayEndpoint = gateway.attrGatewayUrl || "";

    // MCP Configuration for mcp-proxy-for-aws
    const mcpConfig = {
      "aws-security-audit-gateway": {
        command: "uvx",
        args: ["mcp-proxy-for-aws", this.gatewayEndpoint],
      },
    };
    this.mcpConfigOutput = JSON.stringify(mcpConfig, null, 2);

    new cdk.CfnOutput(this, "GatewayEndpoint", {
      value: this.gatewayEndpoint,
      description: "AgentCore Gateway endpoint URL",
    });

    new cdk.CfnOutput(this, "GatewayArn", {
      value: gateway.attrGatewayArn,
      description: "AgentCore Gateway ARN (for IAM permissions)",
    });

    new cdk.CfnOutput(this, "GatewayId", {
      value: gatewayIdToken,
      description: "AgentCore Gateway ID",
    });

    new cdk.CfnOutput(this, "LambdaFunctionArn", {
      value: lambdaFunction.functionArn,
      description: "Lambda function ARN",
    });

    new cdk.CfnOutput(this, "McpConfiguration", {
      value: this.mcpConfigOutput,
      description: "MCP configuration JSON (copy to Tool Configuration)",
    });

    new cdk.CfnOutput(this, "IamPermissionRequired", {
      value: JSON.stringify(
        {
          Action: "bedrock-agentcore:InvokeGateway",
          Resource: gateway.attrGatewayArn,
        },
        null,
        2,
      ),
      description: "IAM permission to add to AgentCore Runtime role",
    });
  }
}
