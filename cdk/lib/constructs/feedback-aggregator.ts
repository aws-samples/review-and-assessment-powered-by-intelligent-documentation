import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as path from "path";
import { Construct } from "constructs";
import { DockerPrismaFunction } from "./docker-prisma-function";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import { DatabaseConnectionProps } from "./database";

export interface FeedbackAggregatorProps {
  vpc: ec2.IVpc;
  databaseConnection: DatabaseConnectionProps;
  bedrockRegion: string;
  aggregationDays?: number;
  scheduleExpression?: string;
  summaryModelId?: string;
}

export class FeedbackAggregator extends Construct {
  public readonly lambda: lambda.Function;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: FeedbackAggregatorProps) {
    super(scope, id);

    const aggregationDays = props.aggregationDays || 7;
    const scheduleExpression = props.scheduleExpression || "cron(0 2 * * ? *)";
    const summaryModelId =
      props.summaryModelId || "global.anthropic.claude-sonnet-4-20250514-v1:0";

    // Security group
    this.securityGroup = new ec2.SecurityGroup(this, "SecurityGroup", {
      vpc: props.vpc,
      description: "Security group for Feedback Aggregator Lambda",
      allowAllOutbound: true,
    });

    // Lambda function
    this.lambda = new DockerPrismaFunction(this, "Function", {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, "../../../backend/"),
        {
          file: "Dockerfile.prisma.lambda",
          platform: Platform.LINUX_ARM64,
          cmd: ["dist/feedback-aggregator/index.handler"],
        }
      ),
      memorySize: 1024,
      timeout: cdk.Duration.minutes(15),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      environment: {
        FEEDBACK_AGGREGATION_DAYS: aggregationDays.toString(),
        BEDROCK_REGION: props.bedrockRegion,
        SUMMARY_MODEL_ID: summaryModelId,
        MAX_CONTEXT_TOKENS: "8000",
      },
      securityGroups: [this.securityGroup],
      database: props.databaseConnection,
      architecture: lambda.Architecture.ARM_64,
    });

    // Bedrock permissions
    this.lambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["*"],
      })
    );

    // EventBridge rule for scheduled execution
    const rule = new events.Rule(this, "ScheduleRule", {
      schedule: events.Schedule.expression(scheduleExpression),
      description: "Daily feedback summary aggregation",
    });

    rule.addTarget(new targets.LambdaFunction(this.lambda));
  }
}
