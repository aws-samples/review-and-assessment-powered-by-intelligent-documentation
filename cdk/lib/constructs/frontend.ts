import { Construct } from "constructs";
import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as iam from "aws-cdk-lib/aws-iam";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  IBucket,
} from "aws-cdk-lib/aws-s3";
import {
  CachePolicy,
  Distribution,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { NodejsBuild } from "deploy-time-build";
import { Auth } from "./auth";
import { NagSuppressions } from "cdk-nag";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as path from "path";

export type FrontendDeliveryMode = "cloudfront" | "s3ApiGateway";

export interface FrontendProps {
  readonly webAclId?: string;
  readonly accessLogBucket?: IBucket;
  readonly enableIpV6?: boolean;
  /**
   * Frontend delivery mechanism.
   * - "cloudfront": CloudFront + S3 with OAC (standard mode)
   * - "s3ApiGateway": S3 bucket served through a dedicated API Gateway (S3 proxy).
   *   In this mode CloudFront/OAC/WAF are not created by this construct.
   * @default "cloudfront"
   */
  readonly deliveryMode?: FrontendDeliveryMode;
  /**
   * Alternative domain name for CloudFront distribution (e.g., chat.example.com)
   * If provided, CloudFront will be accessible via this domain
   */
  readonly alternateDomainName?: string;
  /**
   * Route53 hosted zone ID where the alternate domain records will be created
   * Required if alternateDomainName is provided
   */
  readonly hostedZoneId?: string;
}

export class Frontend extends Construct {
  /** Only set in CloudFront delivery mode. */
  readonly cloudFrontWebDistribution?: Distribution;
  readonly assetBucket: Bucket;
  readonly deliveryMode: FrontendDeliveryMode;
  private readonly certificate?: acm.ICertificate;
  private readonly hostedZone?: route53.IHostedZone;
  /** Alternate domain name for the CloudFront distribution */
  private readonly alternateDomainName?: string;
  /**
   * Origin URL for the S3+APIGW delivery mode (frontend API stage URL).
   * Set externally after the FrontendApi is wired up.
   */
  private s3ApiGatewayOrigin?: string;
  /**
   * Base path used when building the SPA (e.g. "/app/") in S3+APIGW mode.
   */
  private buildBasePath = "/";

  constructor(scope: Construct, id: string, props: FrontendProps) {
    super(scope, id);

    this.deliveryMode = props.deliveryMode ?? "cloudfront";
    this.alternateDomainName = props.alternateDomainName;

    const assetBucket = new Bucket(this, "AssetBucket", {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      serverAccessLogsBucket: props.accessLogBucket,
      serverAccessLogsPrefix: "AssetBucket",
    });
    this.assetBucket = assetBucket;

    // S3+APIGW mode: this construct owns only the asset bucket + build.
    // CloudFront/OAC/WAF are skipped; the SPA is served by FrontendApi.
    if (this.deliveryMode === "s3ApiGateway") {
      return;
    }

    if (props.alternateDomainName && props.hostedZoneId) {
      this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(
        this,
        "HostedZone",
        {
          hostedZoneId: props.hostedZoneId,
          zoneName: this.getDomainZoneName(props.alternateDomainName),
        },
      );

      this.certificate = new acm.DnsValidatedCertificate(this, "Certificate", {
        domainName: props.alternateDomainName,
        hostedZone: this.hostedZone,
        region: "us-east-1",
        validation: acm.CertificateValidation.fromDns(this.hostedZone),
      });
    }

    const distribution = new Distribution(this, "Distribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(assetBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
      },
      // Required to pass AwsSolutions-CFR4 check
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      ...(this.alternateDomainName && this.certificate
        ? {
            domainNames: [this.alternateDomainName],
            certificate: this.certificate,
          }
        : {}),
      errorResponses: [
        {
          httpStatus: 404,
          ttl: Duration.seconds(0),
          responseHttpStatus: 200,
          responsePagePath: "/",
        },
        {
          httpStatus: 403,
          ttl: Duration.seconds(0),
          responseHttpStatus: 200,
          responsePagePath: "/",
        },
      ],
      ...(!this.shouldSkipAccessLogging() && {
        logBucket: props.accessLogBucket,
        logFilePrefix: "Frontend/",
      }),
      webAclId: props.webAclId,
      enableIpv6: props.enableIpV6 ?? false,
    });

    if (this.alternateDomainName && this.hostedZone) {
      new route53.ARecord(this, "AliasRecord", {
        zone: this.hostedZone,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(distribution),
        ),
        recordName: this.alternateDomainName,
      });

      if (props.enableIpV6) {
        new route53.AaaaRecord(this, "AaaaRecord", {
          zone: this.hostedZone,
          target: route53.RecordTarget.fromAlias(
            new targets.CloudFrontTarget(distribution),
          ),
          recordName: this.alternateDomainName,
        });
      }
    }

    NagSuppressions.addResourceSuppressions(distribution, [
      {
        id: "AwsPrototyping-CloudFrontDistributionGeoRestrictions",
        reason: "this asset is being used all over the world",
      },
      {
        id: "AwsSolutions-CFR1",
        reason: "Global asset that cannot have geographical restrictions",
      },
      {
        id: "AwsSolutions-CFR4",
        reason:
          "TLS settings have been explicitly set to TLS_V1_2_2021. This is likely a nag tool issue: https://github.com/cdklabs/cdk-nag/issues/1101",
      },
    ]);

    // ReactBuild is created later in buildViteApp, so we'll add suppressions there

    this.cloudFrontWebDistribution = distribution;

    if (this.alternateDomainName) {
      new CfnOutput(this, "AlternateDomain", {
        value: this.alternateDomainName,
        description: "Alternate domain name for the CloudFront distribution",
      });
    }
    if (this.certificate) {
      new CfnOutput(this, "CertificateArn", {
        value: this.certificate.certificateArn,
        description: "ARN of the ACM certificate",
      });
    }
  }

  /**
   * Wire the S3+APIGW delivery mode: origin URL + SPA build base path ("/app/").
   */
  configureS3ApiGatewayDelivery({
    origin,
    basePath,
  }: {
    origin: string;
    basePath: string;
  }) {
    this.s3ApiGatewayOrigin = origin;
    this.buildBasePath = basePath;
  }

  /**
   * Extracts the parent domain from a full domain name
   * e.g., 'chat.example.com' -> 'example.com'
   */
  private getDomainZoneName(domainName: string): string {
    const parts = domainName.split(".");
    if (parts.length <= 2) return domainName;
    return parts.slice(-2).join(".");
  }

  getOrigin(): string {
    if (this.deliveryMode === "s3ApiGateway") {
      if (!this.s3ApiGatewayOrigin) {
        throw new Error(
          "Frontend.getOrigin() called before configureS3ApiGatewayDelivery() in s3ApiGateway mode",
        );
      }
      return this.s3ApiGatewayOrigin;
    }
    if (this.alternateDomainName) {
      return `https://${this.alternateDomainName}`;
    }
    return `https://${this.cloudFrontWebDistribution!.distributionDomainName}`;
  }

  buildViteApp({
    backendApiEndpoint,
    userPoolDomainPrefix,
    auth,
    version,
  }: {
    backendApiEndpoint: string;
    userPoolDomainPrefix: string;
    auth: Auth;
    version?: string; // バージョン情報を追加（オプショナル）
  }) {
    const region = Stack.of(auth.userPool).region;
    const cognitoDomain = `${userPoolDomainPrefix}.auth.${region}.amazoncognito.com/`;
    const buildEnvProps = (() => {
      const defaultProps: { [key: string]: string } = {
        VITE_APP_API_ENDPOINT: backendApiEndpoint,
        VITE_APP_USER_POOL_ID: auth.userPool.userPoolId,
        VITE_APP_USER_POOL_CLIENT_ID: auth.client.userPoolClientId,
        VITE_APP_REGION: region,
        VITE_APP_VERSION: version || "unknown ver", // バージョン情報を追加
      };

      // S3+APIGW mode: SPA is under the stage prefix, so Vite needs that base.
      if (this.deliveryMode === "s3ApiGateway") {
        defaultProps.VITE_APP_BASE_PATH = this.buildBasePath;
      }

      return defaultProps;

      // const oAuthProps = {
      //   VITE_APP_REDIRECT_SIGNIN_URL: this.getOrigin(),
      //   VITE_APP_REDIRECT_SIGNOUT_URL: this.getOrigin(),
      //   VITE_APP_COGNITO_DOMAIN: cognitoDomain,
      //   VITE_APP_SOCIAL_PROVIDERS: idp.getSocialProviders(),
      //   VITE_APP_CUSTOM_PROVIDER_ENABLED: idp
      //     .checkCustomProviderEnabled()
      //     .toString(),
      //   VITE_APP_CUSTOM_PROVIDER_NAME: idp.getCustomProviderName(),
      // };
      // return { ...defaultProps, ...oAuthProps };
    })();

    const reactBuild = new NodejsBuild(this, "ReactBuild", {
      assets: [
        {
          // path: "../frontend",
          path: path.join(__dirname, "../../../frontend/"),
          exclude: [
            "node_modules",
            "dist",
            "dev-dist",
            ".env",
            ".env.local",
            "../cdk/**/*",
            "../backend/**/*",
            "../example/**/*",
            "../docs/**/*",
            "../.github/**/*",
          ],
          commands: ["npm ci"],
        },
      ],
      buildCommands: ["npm run build"],
      buildEnvironment: buildEnvProps,
      destinationBucket: this.assetBucket,
      // In S3+APIGW mode there's no CloudFront distribution to invalidate.
      ...(this.deliveryMode === "cloudfront" && this.cloudFrontWebDistribution
        ? { distribution: this.cloudFrontWebDistribution }
        : {}),
      outputSourceDirectory: "dist",
    });

    // The CloudFront invalidation IAM workaround only applies in CloudFront mode.
    if (this.deliveryMode === "cloudfront" && this.cloudFrontWebDistribution) {
      // This is a workaround for the issue where the BucketDeployment construct
      // does not have permissions to create CloudFront invalidations
      // Ref: https://github.com/aws/aws-cdk/issues/23708
      const bucketDeploy = reactBuild.node
        .findAll()
        .find(
          (c) => c instanceof s3deploy.BucketDeployment,
        ) as s3deploy.BucketDeployment;

      bucketDeploy?.handlerRole?.addToPrincipalPolicy(
        new iam.PolicyStatement({
          actions: [
            "cloudfront:CreateInvalidation",
            "cloudfront:GetInvalidation",
          ],
          resources: [
            `arn:aws:cloudfront::${Stack.of(this).account}:distribution/${
              this.cloudFrontWebDistribution.distributionId
            }`,
          ],
        }),
      );
    }

    // Add suppressions for CodeBuild-related findings
    NagSuppressions.addResourceSuppressions(
      reactBuild,
      [
        {
          id: "AwsSolutions-CB4",
          reason:
            "KMS encryption settings cannot be changed because it's a third-party library",
        },
      ],
      true,
    );
  }

  /**
   * CloudFront does not support access log delivery in the following regions
   * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/AccessLogs.html#access-logs-choosing-s3-bucket
   */
  private shouldSkipAccessLogging(): boolean {
    const skipLoggingRegions = [
      "af-south-1",
      "ap-east-1",
      "ap-south-2",
      "ap-southeast-3",
      "ap-southeast-4",
      "ca-west-1",
      "eu-south-1",
      "eu-south-2",
      "eu-central-2",
      "il-central-1",
      "me-central-1",
    ];
    return skipLoggingRegions.includes(Stack.of(this).region);
  }
}
