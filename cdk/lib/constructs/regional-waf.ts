/**
 * REGIONAL WAF (IP allowlist) associated with API Gateway stages, for the
 * S3+APIGW / closed-network modes where there is no CloudFront distribution.
 */
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";

export interface RegionalWafProps {
  readonly allowedIpV4AddressRanges: string[];
  readonly allowedIpV6AddressRanges: string[];
  /**
   * Stages to associate. Passing Stage constructs (not raw ARNs) ensures the
   * association is created only after the stage exists.
   */
  readonly stages: apigateway.Stage[];
}

export class RegionalWaf extends Construct {
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: RegionalWafProps) {
    super(scope, id);

    const rules: wafv2.CfnWebACL.RuleProperty[] = [];

    if (props.allowedIpV4AddressRanges.length > 0) {
      const ipV4Set = new wafv2.CfnIPSet(this, "RegionalIpV4Set", {
        ipAddressVersion: "IPV4",
        scope: "REGIONAL",
        addresses: props.allowedIpV4AddressRanges,
      });
      rules.push({
        priority: 0,
        name: "RapidRegionalWebAclIpV4RuleSet",
        action: { allow: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: "RegionalWebAclIpV4",
          sampledRequestsEnabled: true,
        },
        statement: {
          ipSetReferenceStatement: { arn: ipV4Set.attrArn },
        },
      });
    }

    if (props.allowedIpV6AddressRanges.length > 0) {
      const ipV6Set = new wafv2.CfnIPSet(this, "RegionalIpV6Set", {
        ipAddressVersion: "IPV6",
        scope: "REGIONAL",
        addresses: props.allowedIpV6AddressRanges,
      });
      rules.push({
        priority: 1,
        name: "RapidRegionalWebAclIpV6RuleSet",
        action: { allow: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: "RegionalWebAclIpV6",
          sampledRequestsEnabled: true,
        },
        statement: {
          ipSetReferenceStatement: { arn: ipV6Set.attrArn },
        },
      });
    }

    if (rules.length === 0) {
      throw new Error(
        "One or more allowed IP ranges must be specified in IPv4 or IPv6.",
      );
    }

    const webAcl = new wafv2.CfnWebACL(this, "RegionalWebAcl", {
      defaultAction: { block: {} },
      name: `${cdk.Stack.of(this).stackName}-RapidRegionalWebAcl`,
      scope: "REGIONAL",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "RegionalWebAcl",
        sampledRequestsEnabled: true,
      },
      rules,
    });

    this.webAclArn = webAcl.attrArn;

    // Associate the Web ACL with each API Gateway stage.
    props.stages.forEach((stage, index) => {
      const association = new wafv2.CfnWebACLAssociation(
        this,
        `StageAssociation${index}`,
        {
          resourceArn: stage.stageArn,
          webAclArn: this.webAclArn,
        },
      );
      // Ensure the stage (and its deployment) exists before associating.
      association.node.addDependency(stage);
    });

    new cdk.CfnOutput(this, "RegionalWebAclArn", {
      value: this.webAclArn,
      description: "ARN of the regional WAF Web ACL",
    });
  }
}
