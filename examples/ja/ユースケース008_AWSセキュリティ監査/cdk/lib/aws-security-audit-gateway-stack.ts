import * as cdk from 'aws-cdk-lib';
import { Aws, Names } from 'aws-cdk-lib';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import * as cfnAgentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import * as path from 'path';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';

export class AwsSecurityAuditGatewayStack extends cdk.Stack {
  public readonly gatewayEndpoint: string;
  public readonly mcpConfigOutput: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const region = cdk.Stack.of(this).region;
    const accountId = cdk.Stack.of(this).account;

    // ========================================================================
    // IMPORTANT: Fixed unique ID (must be stable across deployments)
    //
    // - Do NOT use timestamps or random values (Cognito Domain creation fails)
    // - Use a fixed string that doesn't change between deployments
    // - Cognito domain prefix will be: uc8-rt-{uniqueId}
    //
    // If deployment fails with "Domain already exists" error:
    //   Change "uc008" to another value (e.g., "uc008v2", "uc008-yourname")
    // ========================================================================
    const uniqueId = "uc008";

    // =================================================================
    // SECTION 1: Runtime Cognito (M2M)
    // =================================================================

    const runtimeUserPool = new cognito.UserPool(this, 'RuntimeUserPool', {
      userPoolName: `uc8-runtime-${uniqueId}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add Cognito Domain for OAuth2 token endpoint
    const poolDomain = runtimeUserPool.addDomain('RuntimeDomain', {
      cognitoDomain: {
        domainPrefix: `uc8-rt-${uniqueId}`,
      },
    });

    const resourceServer = new cognito.UserPoolResourceServer(
      this,
      'ResourceServer',
      {
        userPool: runtimeUserPool,
        identifier: `runtime-${uniqueId}`,
        scopes: [
          {
            scopeName: 'tools',
            scopeDescription: 'Access MCP tools',
          },
        ],
      }
    );

    const toolsScope = new cognito.ResourceServerScope({
      scopeName: 'tools',
      scopeDescription: 'Access MCP tools',
    });

    const m2mClient = new cognito.UserPoolClient(this, 'M2MClient', {
      userPool: runtimeUserPool,
      generateSecret: true,
      oAuth: {
        flows: { clientCredentials: true },
        scopes: [
          cognito.OAuthScope.resourceServer(resourceServer, toolsScope),
        ],
      },
    });

    // =================================================================
    // SECTION 2: Get Client Secret (Custom Resource)
    // =================================================================

    const describeClient = new cr.AwsCustomResource(this, 'GetClientSecret', {
      onCreate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'describeUserPoolClient',
        parameters: {
          UserPoolId: runtimeUserPool.userPoolId,
          ClientId: m2mClient.userPoolClientId,
        },
        physicalResourceId: cr.PhysicalResourceId.of('DescribeRuntimeClient'),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['cognito-idp:DescribeUserPoolClient'],
          resources: [runtimeUserPool.userPoolArn],
        }),
      ]),
    });

    const clientSecret = describeClient.getResponseField(
      'UserPoolClient.ClientSecret'
    );
    const discoveryUrl = `https://cognito-idp.${region}.amazonaws.com/${runtimeUserPool.userPoolId}/.well-known/openid-configuration`;

    // =================================================================
    // SECTION 3: OAuth2 Credential Provider (Custom Resource)
    // =================================================================

    const oauth2Provider = new cr.AwsCustomResource(this, 'OAuth2ProviderV2', {
      onCreate: {
        service: 'bedrock-agentcore-control',
        action: 'createOauth2CredentialProvider',
        parameters: {
          name: `oauth-uc8-${uniqueId}`,
          credentialProviderVendor: 'CustomOauth2',
          oauth2ProviderConfigInput: {
            customOauth2ProviderConfig: {
              oauthDiscovery: { discoveryUrl },
              clientId: m2mClient.userPoolClientId,
              clientSecret,
            },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.fromResponse(
          'credentialProviderArn'
        ),
      },
      onUpdate: {
        service: 'bedrock-agentcore-control',
        action: 'createOauth2CredentialProvider',
        parameters: {
          name: `oauth-uc8-${uniqueId}`,
          credentialProviderVendor: 'CustomOauth2',
          oauth2ProviderConfigInput: {
            customOauth2ProviderConfig: {
              oauthDiscovery: { discoveryUrl },
              clientId: m2mClient.userPoolClientId,
              clientSecret,
            },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.fromResponse(
          'credentialProviderArn'
        ),
      },
      onDelete: {
        service: 'bedrock-agentcore-control',
        action: 'deleteOauth2CredentialProvider',
        parameters: { name: `oauth-uc8-${uniqueId}` },
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['bedrock-agentcore:*', 'secretsmanager:*'],
          resources: ['*'],
        }),
      ]),
      timeout: cdk.Duration.minutes(5),
    });

    const credentialProviderArn = oauth2Provider.getResponseField(
      'credentialProviderArn'
    );

    // =================================================================
    // SECTION 4: Runtime Task Role
    // =================================================================

    const runtimeTaskRole = new iam.Role(this, 'RuntimeTaskRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
    });

    // Security audit permissions
    runtimeTaskRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'SecurityAuditReadAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          // RDS
          'rds:Describe*',
          // S3
          's3:Get*',
          's3:List*',
          // IAM
          'iam:Get*',
          'iam:List*',
          'iam:GenerateCredentialReport',
          // CloudTrail
          'cloudtrail:Describe*',
          'cloudtrail:Get*',
          'cloudtrail:List*',
          'cloudtrail:LookupEvents',
          // EC2/VPC
          'ec2:Describe*',
          // Config
          'config:Describe*',
          'config:Get*',
          'config:List*',
          // GuardDuty
          'guardduty:Get*',
          'guardduty:List*',
          // CloudWatch Logs
          'logs:Describe*',
          'logs:Get*',
          'logs:FilterLogEvents',
          // SNS/SQS (for notification audits)
          'sns:Get*',
          'sns:List*',
          'sqs:Get*',
          'sqs:List*',
        ],
        resources: ['*'],
      })
    );

    // =================================================================
    // SECTION 5: AgentCore Runtime (L2 Construct)
    // =================================================================

    const runtime = new agentcore.Runtime(this, 'Runtime', {
      runtimeName: `uc8runtime${uniqueId}`,
      agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(
        path.join(__dirname, 'runtime-mcp-server'),
        { platform: Platform.LINUX_ARM64 }
      ),
      protocolConfiguration: agentcore.ProtocolType.MCP,
      authorizerConfiguration:
        agentcore.RuntimeAuthorizerConfiguration.usingCognito(runtimeUserPool, [
          m2mClient,
        ]),
      executionRole: runtimeTaskRole,
    });

    // =================================================================
    // SECTION 6: Gateway (IAM auth)
    // =================================================================

    const gatewayRole = new iam.Role(this, 'GatewayRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
    });

    // Add Gateway permissions
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

    const gateway = new cfnAgentcore.CfnGateway(this, 'Gateway', {
      name: `uc8-gateway-${uniqueId}`,
      roleArn: gatewayRole.roleArn,
      authorizerType: 'AWS_IAM',
      protocolType: 'MCP',
      protocolConfiguration: {
        mcp: {
          instructions:
            'Gateway for AWS Security Audit using Runtime MCP server',
          searchType: 'SEMANTIC',
        },
      },
    } as any);

    // =================================================================
    // SECTION 7: Gateway Target
    // =================================================================

    // Encode Runtime ARN for URL (using CloudFormation functions for proper token handling)
    // Replace ':' with '%3A' and '/' with '%2F', then add qualifier parameter
    const encodedRuntimeArn = cdk.Fn.join('', [
      'https://bedrock-agentcore.',
      region,
      '.amazonaws.com/runtimes/',
      cdk.Fn.join(
        '%2F',
        cdk.Fn.split(
          '/',
          cdk.Fn.join('%3A', cdk.Fn.split(':', runtime.agentRuntimeArn))
        )
      ),
      '/invocations?qualifier=DEFAULT',
    ]);

    const scopeString = `${resourceServer.userPoolResourceServerId}/tools`;

    const gatewayIdToken = cdk.Fn.select(1, cdk.Fn.split('/', gateway.attrGatewayArn));

    const gatewayTarget = new cfnAgentcore.CfnGatewayTarget(
      this,
      'GatewayTarget',
      {
        name: 'aws-api-mcp-server',
        gatewayIdentifier: gatewayIdToken,
        credentialProviderConfigurations: [
          {
            credentialProviderType: 'OAUTH',
            credentialProvider: {
              oauthCredentialProvider: {
                providerArn: credentialProviderArn,
                scopes: [scopeString],
              },
            },
          },
        ],
        targetConfiguration: {
          mcp: {
            mcpServer: {
              endpoint: encodedRuntimeArn,
            },
          },
        },
      } as any
    );

    // =================================================================
    // SECTION 8: Outputs
    // =================================================================

    this.gatewayEndpoint = gateway.attrGatewayUrl || '';

    // Create MCP configuration JSON for Stack output (IAM auth with MCP Proxy)
    const mcpConfig = {
      'aws-security-audit-gateway': {
        command: 'uvx',
        args: ['mcp-proxy-for-aws', this.gatewayEndpoint],
      },
    };
    this.mcpConfigOutput = JSON.stringify(mcpConfig, null, 2);

    new cdk.CfnOutput(this, 'GatewayEndpoint', {
      value: this.gatewayEndpoint,
      description: 'AgentCore Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'GatewayArn', {
      value: gateway.attrGatewayArn,
      description: 'AgentCore Gateway ARN (for IAM permissions)',
    });

    new cdk.CfnOutput(this, 'RuntimeArn', {
      value: runtime.agentRuntimeArn,
      description: 'Runtime ARN',
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: `${poolDomain.domainName}.auth.${region}.amazoncognito.com`,
      description: 'Cognito Domain for OAuth2 token endpoint',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: runtimeUserPool.userPoolId,
      description: 'Runtime User Pool ID',
    });

    new cdk.CfnOutput(this, 'ClientId', {
      value: m2mClient.userPoolClientId,
      description: 'M2M Client ID',
    });

    new cdk.CfnOutput(this, 'Scope', {
      value: scopeString,
      description: 'OAuth2 Scope for token request',
    });

    new cdk.CfnOutput(this, 'McpConfiguration', {
      value: this.mcpConfigOutput,
      description: 'MCP configuration JSON (copy to Tool Configuration)',
    });

    new cdk.CfnOutput(this, 'IamPermissionRequired', {
      value: JSON.stringify(
        {
          Action: 'bedrock-agentcore:InvokeGateway',
          Resource: gateway.attrGatewayArn,
        },
        null,
        2
      ),
      description: 'IAM permission to add to AgentCore Runtime role',
    });
  }
}
