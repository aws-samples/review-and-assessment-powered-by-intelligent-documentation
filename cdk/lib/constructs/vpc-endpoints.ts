/**
 * VPC Endpoints for closed-network mode.
 *
 * In closed mode the VPC has no NAT gateway and only isolated subnets, so every
 * AWS service the runtime touches must be reachable through a VPC endpoint.
 *
 * - Gateway endpoint: S3 (in-VPC/Lambda S3 traffic + ECR image layers live in S3)
 * - Interface endpoints (private DNS enabled, in isolated subnets, dedicated SG):
 *   ECR API, ECR Docker, CloudWatch Logs, Secrets Manager, STS, execute-api,
 *   Bedrock Runtime, Bedrock Agent Runtime, SQS, Step Functions, Lambda,
 *   Cognito IDP (PrivateLink), S3 interface (browser presigned upload/download),
 *   Bedrock AgentCore (InvokeAgentRuntime + agent data-plane).
 */
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";

export interface VpcEndpointsProps {
  readonly vpc: ec2.IVpc;
  /**
   * Subnets the interface endpoints are placed in. Defaults to the VPC's
   * isolated subnets (closed mode).
   */
  readonly subnetSelection?: ec2.SubnetSelection;
}

export class VpcEndpoints extends Construct {
  /**
   * The execute-api interface endpoint. PRIVATE API Gateways reference this so
   * their resource policy can be locked to it via aws:SourceVpce.
   */
  public readonly executeApiEndpoint: ec2.InterfaceVpcEndpoint;

  /** Security group attached to all interface endpoints. */
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: VpcEndpointsProps) {
    super(scope, id);

    const { vpc } = props;
    const subnets = props.subnetSelection ?? {
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    };

    // Dedicated SG for the interface endpoints; allow inbound 443 from the VPC
    // CIDR so in-VPC Lambdas / AgentCore runtime can reach the endpoints.
    this.securityGroup = new ec2.SecurityGroup(this, "EndpointSecurityGroup", {
      vpc,
      description: "Security group for VPC interface endpoints (closed mode)",
      allowAllOutbound: true,
    });
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(443),
      "Allow HTTPS from within the VPC to interface endpoints",
    );

    // The ingress rule references the VPC CIDR via a CloudFormation intrinsic,
    // which cdk-nag cannot statically evaluate for AwsSolutions-EC23. The rule
    // is intentionally scoped to the VPC CIDR on port 443 only.
    NagSuppressions.addResourceSuppressions(
      this.securityGroup,
      [
        {
          id: "AwsSolutions-EC23",
          reason:
            "Interface endpoint SG allows inbound 443 only from the VPC CIDR (an intrinsic ref cdk-nag cannot evaluate). Endpoints are only reachable from within the isolated VPC.",
        },
      ],
      true,
    );

    // Gateway endpoint: S3 (also serves ECR image layers for in-VPC pulls).
    vpc.addGatewayEndpoint("S3GatewayEndpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [subnets],
    });

    // Interface endpoints.
    const interfaceServices: Record<
      string,
      ec2.InterfaceVpcEndpointAwsService
    > = {
      EcrApi: ec2.InterfaceVpcEndpointAwsService.ECR,
      EcrDocker: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      CloudWatchLogs: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      SecretsManager: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      Sts: ec2.InterfaceVpcEndpointAwsService.STS,
      BedrockRuntime: ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
      BedrockAgentRuntime:
        ec2.InterfaceVpcEndpointAwsService.BEDROCK_AGENT_RUNTIME,
      BedrockAgentCore: ec2.InterfaceVpcEndpointAwsService.BEDROCK_AGENTCORE,
      Sqs: ec2.InterfaceVpcEndpointAwsService.SQS,
      StepFunctions: ec2.InterfaceVpcEndpointAwsService.STEP_FUNCTIONS,
      Lambda: ec2.InterfaceVpcEndpointAwsService.LAMBDA,
      CognitoIdp: ec2.InterfaceVpcEndpointAwsService.COGNITO_IDP,
      S3Interface: ec2.InterfaceVpcEndpointAwsService.S3,
      // SSM endpoints so instances in the isolated VPC (e.g. an admin/test host)
      // can be managed via Session Manager / Fleet Manager without NAT.
      Ssm: ec2.InterfaceVpcEndpointAwsService.SSM,
      SsmMessages: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
      Ec2Messages: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
    };

    for (const [name, service] of Object.entries(interfaceServices)) {
      vpc.addInterfaceEndpoint(`${name}Endpoint`, {
        service,
        privateDnsEnabled: true,
        subnets,
        securityGroups: [this.securityGroup],
        // Some services (e.g. cognito-idp in us-east-1) are not offered in every
        // AZ. Let CDK query DescribeVpcEndpointServices and place the endpoint
        // only in AZs that support it, avoiding "does not support the
        // availability zone of the subnet" failures.
        lookupSupportedAzs: true,
      });
    }

    // execute-api is created separately because the API constructs need a
    // reference to it for their PRIVATE resource policy (aws:SourceVpce).
    this.executeApiEndpoint = vpc.addInterfaceEndpoint("ExecuteApiEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
      privateDnsEnabled: true,
      subnets,
      securityGroups: [this.securityGroup],
      lookupSupportedAzs: true,
    });
  }
}
