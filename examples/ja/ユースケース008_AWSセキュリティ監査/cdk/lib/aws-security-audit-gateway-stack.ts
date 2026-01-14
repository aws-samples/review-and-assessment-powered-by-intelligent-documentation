import * as cdk from 'aws-cdk-lib';
import { Aws, Names } from 'aws-cdk-lib';
import * as agentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';

export class AwsSecurityAuditGatewayStack extends cdk.Stack {
  public readonly gatewayEndpoint: string;
  public readonly mcpConfigOutput: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const region = cdk.Stack.of(this).region;
    const accountId = cdk.Stack.of(this).account;

    // 1. Create Gateway IAM role
    const gatewayRole = new iam.Role(this, 'GatewayRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
    });

    // Add necessary Gateway permissions
    gatewayRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'GetGateway',
        effect: iam.Effect.ALLOW,
        actions: ['bedrock-agentcore:GetGateway'],
        resources: [`arn:aws:bedrock-agentcore:${region}:${accountId}:gateway/*`],
      })
    );

    gatewayRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'GetWorkloadAccessToken',
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock-agentcore:GetWorkloadAccessToken',
          'bedrock-agentcore:GetWorkloadAccessTokenForJWT',
        ],
        resources: [
          `arn:aws:bedrock-agentcore:${region}:${accountId}:workload-identity-directory/*`,
        ],
      })
    );

    gatewayRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'GetResourceOauth2Token',
        effect: iam.Effect.ALLOW,
        actions: ['bedrock-agentcore:GetResourceOauth2Token'],
        resources: [
          `arn:aws:bedrock-agentcore:${region}:${accountId}:token-vault/*`,
          `arn:aws:bedrock-agentcore:${region}:${accountId}:workload-identity-directory/*`,
        ],
      })
    );

    gatewayRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'GetSecretValue',
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [`arn:aws:secretsmanager:${region}:${accountId}:secret:*`],
      })
    );

    gatewayRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'InvokeLambda',
        effect: iam.Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [`arn:aws:lambda:${region}:${accountId}:function:*`],
      })
    );

    // 2. Create AgentCore Gateway with IAM auth
    const gatewayName = Names.uniqueResourceName(this, {
      maxLength: 100,
      separator: '-',
    }).toLowerCase();

    const gateway = new agentcore.CfnGateway(this, 'Gateway', {
      name: gatewayName,
      roleArn: gatewayRole.roleArn,
      authorizerType: 'AWS_IAM',
      protocolType: 'MCP',
      protocolConfiguration: {
        mcp: {
          instructions: 'Gateway for AWS Security Audit using aws-api-mcp-server',
          searchType: 'SEMANTIC',
        },
      },
    } as any);

    // 3. Create Lambda Tool (Docker image with Python + Node.js)
    const lambdaFunction = new lambda.DockerImageFunction(this, 'McpProxyTool', {
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, 'lambda-tool')),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        HOME: '/tmp',
        AWS_CONFIG_FILE: '/tmp/.aws/config',
        UV_CACHE_DIR: '/tmp/.uv',
        UV_TOOL_DIR: '/tmp/.uv/tools',
      },
    });

    // 4. Add 12 IAM permissions for AWS security APIs
    lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'rds:DescribeDBInstances',
          's3:ListBuckets',
          's3:GetPublicAccessBlock',
          'iam:ListUsers',
          'iam:ListMFADevices',
          'iam:GetAccountPasswordPolicy',
          'cloudtrail:DescribeTrails',
          'cloudtrail:GetTrailStatus',
          'ec2:DescribeVpcs',
          'ec2:DescribeFlowLogs',
          'ec2:DescribeSecurityGroups',
          'ec2:DescribeVolumes',
          'config:DescribeConfigurationRecorders',
          'config:DescribeConfigurationRecorderStatus',
          'guardduty:ListDetectors',
          'guardduty:GetDetector',
        ],
        resources: ['*'],
      })
    );

    // Grant Gateway permission to invoke Lambda
    lambdaFunction.grantInvoke(gatewayRole);

    // 5. Load tool schema
    const schemaPath = path.join(__dirname, 'lambda-tool/tool-schema.json');
    const schemaContent = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    // 6. Extract gateway ID from ARN for GatewayTarget
    const gatewayArn = gateway.attrGatewayArn;
    const gatewayIdToken = cdk.Fn.select(1, cdk.Fn.split('/', gatewayArn));

    // 7. Register Lambda with Gateway
    const gatewayTarget = new agentcore.CfnGatewayTarget(this, 'GatewayTarget', {
      name: 'aws-api-mcp-server',
      gatewayIdentifier: gatewayIdToken,
      credentialProviderConfigurations: [
        {
          credentialProviderType: 'GATEWAY_IAM_ROLE',
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
    } as any);

    // 8. Store gateway endpoint and extract ID from ARN
    this.gatewayEndpoint = gateway.attrGatewayUrl || '';

    // 9. Create MCP configuration JSON for Stack output (IAM auth with MCP Proxy)
    const mcpConfig = {
      'aws-security-audit-gateway': {
        command: 'uvx',
        args: ['mcp-proxy-for-aws', this.gatewayEndpoint],
      },
    };
    this.mcpConfigOutput = JSON.stringify(mcpConfig, null, 2);

    // 10. Output gateway information
    new cdk.CfnOutput(this, 'GatewayEndpoint', {
      value: this.gatewayEndpoint,
      description: 'AgentCore Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'GatewayArn', {
      value: gatewayArn,
      description: 'AgentCore Gateway ARN (for IAM permissions)',
    });

    new cdk.CfnOutput(this, 'GatewayId', {
      value: gatewayIdToken,
      description: 'AgentCore Gateway ID',
    });

    new cdk.CfnOutput(this, 'McpConfiguration', {
      value: this.mcpConfigOutput,
      description: 'MCP configuration JSON (copy to Tool Configuration)',
    });

    new cdk.CfnOutput(this, 'IamPermissionRequired', {
      value: JSON.stringify(
        {
          Action: 'bedrock-agentcore:InvokeGateway',
          Resource: gatewayArn,
        },
        null,
        2
      ),
      description: 'IAM permission to add to AgentCore Runtime role',
    });
  }
}
