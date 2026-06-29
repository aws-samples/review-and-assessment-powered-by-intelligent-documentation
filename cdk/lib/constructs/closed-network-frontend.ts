import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from "path";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import { Auth } from "./auth";
import { NagSuppressions } from "cdk-nag";
import { IBucket } from "aws-cdk-lib/aws-s3";

export interface ClosedNetworkFrontendProps {
  readonly vpc: ec2.IVpc;
  readonly accessLogBucket?: IBucket;
  readonly hostedZone?: route53.IHostedZone;
  readonly certificateArn?: string;
}

/**
 * 閉域モード用フロントエンド（ALB + Fargate）
 * VPC内のプライベートサブネットにALBとFargateを配置し、
 * 静的ファイルをnginxで配信する
 */
export class ClosedNetworkFrontend extends Construct {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  private readonly cluster: ecs.Cluster;
  private readonly vpc: ec2.IVpc;
  private readonly accessLogBucket?: IBucket;
  private readonly hostedZone?: route53.IHostedZone;
  private readonly certificateArn?: string;

  constructor(
    scope: Construct,
    id: string,
    props: ClosedNetworkFrontendProps,
  ) {
    super(scope, id);

    this.vpc = props.vpc;
    this.accessLogBucket = props.accessLogBucket;
    this.hostedZone = props.hostedZone;
    this.certificateArn = props.certificateArn;

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, "Cluster", {
      vpc: this.vpc,
      containerInsights: true,
    });

    // ALB (internal)
    this.alb = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      vpc: this.vpc,
      internetFacing: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    if (this.accessLogBucket) {
      this.alb.logAccessLogs(this.accessLogBucket, "ClosedNetworkFrontendALB");
    }

    NagSuppressions.addResourceSuppressions(this.alb, [
      {
        id: "AwsSolutions-ELB2",
        reason:
          "Access logging is conditionally enabled when accessLogBucket is provided",
      },
      {
        id: "AwsSolutions-EC23",
        reason:
          "Internal ALB in closed network - access is restricted by VPC network boundaries",
      },
    ], true);
  }

  getOrigin(): string {
    if (this.hostedZone && this.certificateArn) {
      return `https://${this.hostedZone.zoneName}`;
    }
    return `http://${this.alb.loadBalancerDnsName}`;
  }

  buildViteApp({
    backendApiEndpoint,
    auth,
    version,
  }: {
    backendApiEndpoint: string;
    auth: Auth;
    version?: string;
  }) {
    const region = Stack.of(auth.userPool).region;

    // Fargate Task Definition
    const taskDef = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    const logGroup = new logs.LogGroup(this, "FrontendLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // API GatewayのURLからホスト名を抽出するためにFn::Selectを使用
    // backendApiEndpoint は https://<id>.execute-api.<region>.amazonaws.com/api/ の形式
    taskDef.addContainer("nginx", {
      image: ecs.ContainerImage.fromAsset(
        path.join(__dirname, "../../../frontend"),
        {
          platform: Platform.LINUX_ARM64,
        },
      ),
      portMappings: [{ containerPort: 80 }],
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: "frontend",
      }),
      environment: {
        VITE_APP_API_ENDPOINT: "/api/",
        VITE_APP_USER_POOL_ID: auth.userPool.userPoolId,
        VITE_APP_USER_POOL_CLIENT_ID: auth.client.userPoolClientId,
        VITE_APP_REGION: region,
        VITE_APP_VERSION: version || "unknown ver",
        BACKEND_API_URL: backendApiEndpoint,
        BACKEND_API_HOST: cdk.Fn.select(
          2,
          cdk.Fn.split("/", backendApiEndpoint),
        ),
      },
    });

    // Fargate Service
    const service = new ecs.FargateService(this, "Service", {
      cluster: this.cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      assignPublicIp: false,
    });

    // ALB Listener & Target
    const listener = this.alb.addListener("Listener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    listener.addTargets("FargateTarget", {
      port: 80,
      targets: [service],
      healthCheck: {
        path: "/",
        interval: Duration.seconds(30),
      },
    });

    // HTTPS listener when certificate is provided
    if (this.hostedZone && this.certificateArn) {
      const certificate = acm.Certificate.fromCertificateArn(
        this,
        "Certificate",
        this.certificateArn,
      );

      const httpsListener = this.alb.addListener("HttpsListener", {
        port: 443,
        protocol: elbv2.ApplicationProtocol.HTTPS,
        certificates: [certificate],
      });

      httpsListener.addTargets("HttpsFargateTarget", {
        port: 80,
        targets: [service],
        healthCheck: {
          path: "/",
          interval: Duration.seconds(30),
        },
      });
    }

    // A record in Private Hosted Zone
    if (this.hostedZone) {
      new route53.ARecord(this, "LbRecord", {
        zone: this.hostedZone,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.LoadBalancerTarget(this.alb),
        ),
      });
    }

    NagSuppressions.addResourceSuppressions(
      listener,
      [
        {
          id: "AwsSolutions-ELB2",
          reason: "Internal ALB in closed network does not require HTTPS",
        },
      ],
      true,
    );

    NagSuppressions.addResourceSuppressions(
      taskDef,
      [
        {
          id: "AwsSolutions-ECS2",
          reason:
            "Environment variables are runtime config injected at container start, not secrets",
        },
      ],
      true,
    );

    NagSuppressions.addResourceSuppressions(
      service,
      [
        {
          id: "AwsSolutions-ECS2",
          reason:
            "Environment variables are build-time config, not secrets",
        },
      ],
      true,
    );
  }
}
