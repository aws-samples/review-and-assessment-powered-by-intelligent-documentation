import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";
import { Duration } from "aws-cdk-lib";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import { DatabaseConnectionProps } from "./database";
import { DockerPrismaFunction } from "./docker-prisma-function";

export interface AmbiguityDetectionProcessorProps {
  vpc: ec2.Vpc;
  databaseConnection: DatabaseConnectionProps;
  bedrockRegion: string;
}

export class AmbiguityDetectionProcessor extends Construct {
  public readonly queue: sqs.Queue;
  public readonly dlq: sqs.Queue;
  public readonly workerLambda: lambda.Function;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(
    scope: Construct,
    id: string,
    props: AmbiguityDetectionProcessorProps
  ) {
    super(scope, id);

    // Security group for Worker Lambda
    this.securityGroup = new ec2.SecurityGroup(this, "WorkerSecurityGroup", {
      vpc: props.vpc,
      description: "Security group for Ambiguity Detection Worker Lambda",
      allowAllOutbound: true,
    });

    // Dead letter queue for failed messages
    this.dlq = new sqs.Queue(this, "DLQ", {
      queueName: "ambiguity-detection-dlq",
      enforceSSL: true,
    });

    // Main queue for ambiguity detection tasks
    this.queue = new sqs.Queue(this, "Queue", {
      queueName: "ambiguity-detection-queue",
      visibilityTimeout: Duration.minutes(17), // Lambda timeout (15min) + 2min buffer
      enforceSSL: true,
      deadLetterQueue: {
        queue: this.dlq,
        maxReceiveCount: 2,
      },
    });

    // Worker Lambda function
    this.workerLambda = new DockerPrismaFunction(this, "WorkerLambda", {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, "../../../backend/"),
        {
          file: "Dockerfile.prisma.lambda",
          platform: Platform.LINUX_ARM64,
          cmd: ["dist/handlers/ambiguity-detection-handler.handler"],
        }
      ),
      memorySize: 1024,
      timeout: Duration.minutes(15),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [this.securityGroup],
      database: props.databaseConnection,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        BEDROCK_REGION: props.bedrockRegion,
      },
    });

    // Connect Lambda function to SQS event source
    this.workerLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(this.queue, {
        batchSize: 1, // Process one message at a time
      })
    );

    // Grant Lambda permission to consume messages
    this.queue.grantConsumeMessages(this.workerLambda);

    // Add Bedrock permissions to worker Lambda
    this.workerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: ["*"],
      })
    );
  }
}
