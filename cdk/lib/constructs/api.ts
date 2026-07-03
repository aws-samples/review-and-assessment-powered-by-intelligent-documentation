/**
 * RAPID API 構成
 */
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from "path";
import { Construct } from "constructs";
import { Auth } from "./auth";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import { DatabaseConnectionProps } from "./database";
import { NagSuppressions } from "cdk-nag";

/**
 * API Constructのプロパティ
 */
export type ApiEndpointMode = "EDGE" | "REGIONAL" | "PRIVATE";

export interface ApiProps {
  vpc: ec2.IVpc;
  databaseConnection: DatabaseConnectionProps;
  environment?: { [key: string]: string };
  auth: Auth;
  /**
   * API Gateway endpoint type.
   * - EDGE:     public edge-optimized endpoint (standard mode)
   * - REGIONAL: public regional endpoint (intermediate S3+APIGW mode)
   * - PRIVATE:  VPC endpoint only (closed network mode)
   * @default "EDGE"
   */
  endpointMode?: ApiEndpointMode;
  /**
   * The execute-api interface VPC endpoint used to reach a PRIVATE API.
   * Required when endpointMode === "PRIVATE".
   */
  vpcEndpoint?: ec2.IInterfaceVpcEndpoint;
  /**
   * Subnet selection for the API Lambda. Defaults to PRIVATE_WITH_EGRESS.
   */
  subnetSelection?: ec2.SubnetSelection;
}

/**
 * RAPID API Construct
 */
export class Api extends Construct {
  public readonly apiLambda: lambda.DockerImageFunction;
  public readonly api: apigateway.RestApi;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    const stackId = cdk.Stack.of(this).stackName;
    const endpointMode = props.endpointMode ?? "EDGE";
    const subnetSelection = props.subnetSelection ?? {
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    };

    if (endpointMode === "PRIVATE" && !props.vpcEndpoint) {
      throw new Error(
        "Api: vpcEndpoint is required when endpointMode is PRIVATE",
      );
    }

    this.securityGroup = new ec2.SecurityGroup(this, "ApiSecurityGroup", {
      vpc: props.vpc,
      description: `Security group for ${stackId} API Lambda function`,
      allowAllOutbound: true,
    });

    // Role
    const handlerRole = new iam.Role(scope, "HandlerRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });
    // Add VPC access to the Lambda function
    handlerRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaVPCAccessExecutionRole",
      ),
    );

    // SecretsManagerへのアクセス権限を追加
    props.databaseConnection.secret.grantRead(handlerRole);

    // Knowledge Base等の外部S3バケットへの読み取り権限を追加
    const region = cdk.Stack.of(this).region;
    const accountId = cdk.Stack.of(this).account;
    handlerRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetObject"],
        resources: ["arn:aws:s3:::*/*"],
        conditions: {
          StringEquals: {
            "s3:ResourceAccount": [accountId],
          },
        },
      }),
    );

    handlerRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "InvokeGatewayForAwsSecurityAudit",
        effect: iam.Effect.ALLOW,
        actions: ["bedrock-agentcore:InvokeGateway"],
        resources: [
          `arn:aws:bedrock-agentcore:${region}:${accountId}:gateway/*`,
        ],
      }),
    );

    // Lambda 関数の作成
    this.apiLambda = new lambda.DockerImageFunction(this, "ApiFunction", {
      role: handlerRole,
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, "../../../backend"),
        {
          platform: Platform.LINUX_ARM64,
        },
      ),
      vpc: props.vpc,
      vpcSubnets: subnetSelection,
      securityGroups: [this.securityGroup],
      environment: {
        ...props.environment,
        DATABASE_SECRET_ARN: props.databaseConnection.secret.secretArn,
        DATABASE_OPTION: "?pool_timeout=20&connect_timeout=20",
        COGNITO_USER_POOL_ID: props.auth.userPool.userPoolId,
        COGNITO_CLIENT_ID: props.auth.client.userPoolClientId,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      architecture: cdk.aws_lambda.Architecture.ARM_64,
    });

    // CloudWatch Logs グループの作成 - スタックIDを含めて名前の衝突を防止
    const accessLogGroup = new logs.LogGroup(this, "ApiGatewayAccessLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      logGroupName: `/aws/apigateway/${stackId}-api-access-logs`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const executionLogGroup = new logs.LogGroup(
      this,
      "ApiGatewayExecutionLogs",
      {
        retention: logs.RetentionDays.ONE_WEEK,
        logGroupName: `/aws/apigateway/${stackId}-api-execution-logs`,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      },
    );

    // API Gateway CloudWatch ロールの作成
    const apiGatewayCloudWatchRole = new iam.Role(
      this,
      "ApiGatewayCloudWatchRole",
      {
        assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AmazonAPIGatewayPushToCloudWatchLogs",
          ),
        ],
      },
    );

    // Resource policy locking a PRIVATE API to the execute-api VPC endpoint.
    let apiPolicy: iam.PolicyDocument | undefined;
    if (endpointMode === "PRIVATE") {
      apiPolicy = new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ["execute-api:Invoke"],
            resources: ["execute-api:/*"],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.DENY,
            principals: [new iam.AnyPrincipal()],
            actions: ["execute-api:Invoke"],
            resources: ["execute-api:/*"],
            conditions: {
              StringNotEquals: {
                "aws:SourceVpce": props.vpcEndpoint!.vpcEndpointId,
              },
            },
          }),
        ],
      });
    }

    const endpointConfiguration =
      endpointMode === "PRIVATE"
        ? {
            types: [apigateway.EndpointType.PRIVATE],
            vpcEndpoints: [props.vpcEndpoint!],
          }
        : endpointMode === "REGIONAL"
          ? { types: [apigateway.EndpointType.REGIONAL] }
          : { types: [apigateway.EndpointType.EDGE] };

    this.api = new apigateway.RestApi(this, "RapidApi", {
      restApiName: `${stackId}-RAPID-API`,
      description:
        "RAPID (Review & Assessment Powered by Intelligent Documentation) API",
      endpointConfiguration,
      ...(apiPolicy ? { policy: apiPolicy } : {}),
      deployOptions: {
        stageName: "api",
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(
          accessLogGroup,
        ),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        methodOptions: {
          "/*/*": {
            loggingLevel: apigateway.MethodLoggingLevel.INFO,
          },
        },
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
        ],
      },
      apiKeySourceType: apigateway.ApiKeySourceType.HEADER,
      cloudWatchRole: true,
    });

    // Lambda 統合の設定
    const lambdaIntegration = new apigateway.LambdaIntegration(this.apiLambda, {
      proxy: true,
    });

    // プロキシリソースの設定
    const proxyResource = this.api.root.addResource("{proxy+}");
    proxyResource.addMethod("ANY", lambdaIntegration);

    // ロググループの ARN を出力
    new cdk.CfnOutput(this, "AccessLogGroupName", {
      value: accessLogGroup.logGroupName,
      description: "Name of the API Gateway access log group",
    });

    new cdk.CfnOutput(this, "ExecutionLogGroupName", {
      value: executionLogGroup.logGroupName,
      description: "Name of the API Gateway execution log group",
    });

    // Add nag suppressions for API Gateway
    NagSuppressions.addResourceSuppressions(
      this.api,
      [
        {
          id: "AwsSolutions-APIG2",
          reason:
            "Request validation is implemented in the backend Lambda using Fastify",
        },
        {
          id: "AwsSolutions-APIG3",
          reason:
            "A regional WAF Web ACL is associated with the API Gateway stage(s) in S3+APIGW/closed modes. In standard mode WAF is applied at CloudFront.",
        },
        {
          id: "AwsSolutions-APIG4",
          reason:
            "JWT authentication is implemented in the backend Lambda using Fastify",
        },
        {
          id: "AwsSolutions-COG4",
          reason:
            "JWT authentication is implemented in the backend Lambda using Fastify",
        },
      ],
      true,
    );

    // Add IAM role suppressions
    NagSuppressions.addResourceSuppressions(
      apiGatewayCloudWatchRole,
      [
        {
          id: "AwsSolutions-IAM4",
          reason:
            "Managed policies are used for simplicity in this sample application",
        },
      ],
      true,
    );
  }
}
