/**
 * Frontend API Gateway (S3 proxy): serves the SPA from a private S3 bucket via
 * a dedicated REST API. Used by the S3+APIGW (intermediate) and closed-network
 * (PRIVATE) modes. Kept separate from the backend API.
 */
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";

export type FrontendApiEndpointMode = "REGIONAL" | "PRIVATE";

export interface FrontendApiProps {
  /**
   * The private S3 bucket that holds the built SPA assets.
   */
  readonly assetBucket: IBucket;

  /**
   * Endpoint type of the frontend API.
   * - REGIONAL: public regional endpoint (intermediate mode)
   * - PRIVATE:  VPC endpoint only (closed network mode)
   * @default "REGIONAL"
   */
  readonly endpointMode?: FrontendApiEndpointMode;

  /**
   * The execute-api interface VPC endpoint used to reach a PRIVATE API.
   * Required when endpointMode === "PRIVATE".
   */
  readonly vpcEndpoint?: ec2.IInterfaceVpcEndpoint;

  /**
   * The stage name (also the base path prefix) the SPA is served under.
   * @default "app"
   */
  readonly stageName?: string;
}

export class FrontendApi extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly stageName: string;

  constructor(scope: Construct, id: string, props: FrontendApiProps) {
    super(scope, id);

    const stackId = cdk.Stack.of(this).stackName;
    const endpointMode = props.endpointMode ?? "REGIONAL";
    this.stageName = props.stageName ?? "app";

    // Execution role allowing the API Gateway to read objects from the bucket.
    const integrationRole = new iam.Role(this, "S3IntegrationRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
    });
    props.assetBucket.grantRead(integrationRole);

    // Access logs
    const accessLogGroup = new logs.LogGroup(this, "FrontendApiAccessLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      logGroupName: `/aws/apigateway/${stackId}-frontend-access-logs`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // PRIVATE APIs: lock the resource policy to the execute-api VPC endpoint.
    let policy: iam.PolicyDocument | undefined;
    if (endpointMode === "PRIVATE") {
      if (!props.vpcEndpoint) {
        throw new Error(
          "FrontendApi: vpcEndpoint is required when endpointMode is PRIVATE",
        );
      }
      policy = new iam.PolicyDocument({
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
                "aws:SourceVpce": props.vpcEndpoint.vpcEndpointId,
              },
            },
          }),
        ],
      });
    }

    this.api = new apigateway.RestApi(this, "FrontendRestApi", {
      restApiName: `${stackId}-RAPID-Frontend`,
      description:
        "RAPID frontend delivery API (S3 proxy for the SPA static assets)",
      binaryMediaTypes: ["*/*"], // pass assets through as binary
      endpointConfiguration:
        endpointMode === "PRIVATE"
          ? {
              types: [apigateway.EndpointType.PRIVATE],
              vpcEndpoints: [props.vpcEndpoint!],
            }
          : {
              types: [apigateway.EndpointType.REGIONAL],
            },
      ...(policy ? { policy } : {}),
      deployOptions: {
        stageName: this.stageName,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
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
      },
      cloudWatchRole: true,
    });

    const bucketName = props.assetBucket.bucketName;

    // Shared responses. The default (no selectionPattern) 200 mapping is
    // required or API Gateway fails with "No match for output mapping".
    const integrationResponses: apigateway.IntegrationResponse[] = [
      {
        statusCode: "200",
        responseParameters: {
          "method.response.header.Content-Type":
            "integration.response.header.Content-Type",
          "method.response.header.Content-Length":
            "integration.response.header.Content-Length",
          "method.response.header.Date": "integration.response.header.Date",
          // no-cache on index.html so redeploys aren't masked by stale HTML
          "method.response.header.Cache-Control": "'no-cache'",
        },
      },
      {
        statusCode: "403",
        selectionPattern: "403",
        responseTemplates: {
          "application/json": JSON.stringify({ message: "Page not found" }),
        },
      },
      {
        statusCode: "404",
        selectionPattern: "404",
        responseTemplates: {
          "application/json": JSON.stringify({ message: "Page not found" }),
        },
      },
    ];

    const methodResponses: apigateway.MethodResponse[] = [
      {
        statusCode: "200",
        responseModels: { "application/json": apigateway.Model.EMPTY_MODEL },
        responseParameters: {
          "method.response.header.Content-Type": true,
          "method.response.header.Content-Length": true,
          "method.response.header.Date": true,
          "method.response.header.Cache-Control": true,
        },
      },
      { statusCode: "403" },
      { statusCode: "404" },
    ];

    // Root ("/") -> index.html
    const rootIntegration = new apigateway.AwsIntegration({
      service: "s3",
      integrationHttpMethod: "GET",
      path: `${bucketName}/index.html`,
      options: {
        credentialsRole: integrationRole,
        requestParameters: {
          "integration.request.header.Accept": "method.request.header.Accept",
          "integration.request.header.Content-Type":
            "method.request.header.Content-Type",
        },
        contentHandling: apigateway.ContentHandling.CONVERT_TO_TEXT,
        passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
        integrationResponses,
      },
    });
    this.api.root.addMethod("GET", rootIntegration, {
      requestParameters: {
        "method.request.header.Accept": true,
        "method.request.header.Content-Type": true,
      },
      methodResponses,
    });

    // "/{proxy+}" -> S3 object. SPA fallback: the VTL template rewrites
    // extensionless paths (client-side routes) to index.html, returning it
    // with 200 while preserving the URL so React Router handles deep links.
    const proxyResource = this.api.root.addResource("{proxy+}");
    const proxyIntegration = new apigateway.AwsIntegration({
      service: "s3",
      integrationHttpMethod: "GET",
      path: `${bucketName}/{proxy}`,
      options: {
        credentialsRole: integrationRole,
        requestParameters: {
          "integration.request.path.proxy": "method.request.path.proxy",
          "integration.request.header.Accept": "method.request.header.Accept",
          "integration.request.header.Content-Type":
            "method.request.header.Content-Type",
        },
        contentHandling: apigateway.ContentHandling.CONVERT_TO_TEXT,
        passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
        requestTemplates: {
          "application/json": [
            "#if(!$input.params('proxy').contains('.'))",
            "  #set($context.requestOverride.path.proxy = 'index.html')",
            "#end",
          ].join("\n"),
        },
        integrationResponses,
      },
    });
    proxyResource.addMethod("GET", proxyIntegration, {
      requestParameters: {
        "method.request.path.proxy": true,
        "method.request.header.Accept": true,
        "method.request.header.Content-Type": true,
      },
      methodResponses,
    });

    new cdk.CfnOutput(this, "FrontendApiUrl", {
      value: this.api.url,
      description: "Frontend API URL serving the SPA",
    });

    // cdk-nag suppressions for the S3 proxy API.
    NagSuppressions.addResourceSuppressions(
      this.api,
      [
        {
          id: "AwsSolutions-APIG2",
          reason:
            "Static asset S3 proxy; request validation is not applicable to GET-only asset delivery",
        },
        {
          id: "AwsSolutions-APIG4",
          reason:
            "Public/private static asset delivery does not require API-level authorization; access is controlled by WAF (regional) and, in closed mode, the PRIVATE endpoint resource policy",
        },
        {
          id: "AwsSolutions-COG4",
          reason:
            "Static asset delivery does not use a Cognito authorizer; it serves the unauthenticated SPA shell",
        },
      ],
      true,
    );

    NagSuppressions.addResourceSuppressions(
      integrationRole,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "S3 GetObject grant on the private asset bucket uses object-level wildcard which is required for serving arbitrary SPA asset keys",
        },
      ],
      true,
    );
  }

  /** SPA origin URL including the stage path (e.g. .../app). */
  getOrigin(): string {
    return this.api.url.replace(/\/$/, "");
  }

  /** Base path the SPA must be built with (e.g. "/app/"). */
  getBasePath(): string {
    return `/${this.stageName}/`;
  }

  /** Deployed stage (used for WAF association as a construct dependency). */
  getStage(): apigateway.Stage {
    return this.api.deploymentStage;
  }

  /** Deployed stage ARN. */
  getStageArn(): string {
    return this.api.deploymentStage.stageArn;
  }
}
