#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { Aspects } from "aws-cdk-lib";
import { RapidStack } from "../lib/rapid-stack";
import { FrontendWafStack } from "../lib/frontend-waf-stack";
import {
  extractContextParameters,
  resolveParameters,
} from "../lib/parameter-schema";
import { AwsSolutionsChecks } from "cdk-nag";

const app = new cdk.App();

// コマンドライン引数からパラメータを抽出
const contextParams = extractContextParameters(app);

// パラメータの解決とバリデーション
// (parameter.tsのデフォルト値 < parameter.tsのユーザー指定値 < コマンドライン引数の順で優先)
const parameters = resolveParameters(contextParams);

// closedNetwork always implies the S3+APIGW frontend (CloudFront is impossible
// in a closed network). In both intermediate and closed modes the CloudFront
// WAF stack (us-east-1) is skipped; a REGIONAL WAF is created inside RapidStack.
const useS3ApiGwFrontend =
  parameters.s3ApiGatewayFrontend || parameters.closedNetwork;

// WAF for frontend
// 2025/4: Currently, the WAF for CloudFront needs to be created in the North America region (us-east-1), so the stacks are separated
// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-wafv2-webacl.html
const waf = useS3ApiGwFrontend
  ? undefined
  : new FrontendWafStack(app, `RapidFrontendWafStack`, {
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: "us-east-1",
      },
      envPrefix: "",
      allowedIpV4AddressRanges: parameters.allowedIpV4AddressRanges,
      allowedIpV6AddressRanges: parameters.allowedIpV6AddressRanges,
    });

new RapidStack(app, "RapidStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-west-2",
  },
  // crossRegionReferences is only needed when referencing the us-east-1 WAF stack.
  crossRegionReferences: waf !== undefined,
  webAclId: waf?.webAclArn.value,
  enableIpV6: waf?.ipV6Enabled ?? false,
  // カスタムパラメータを追加
  parameters: parameters,
});

// Add AWS Solutions Checks
Aspects.of(app).add(new AwsSolutionsChecks());

// Import and apply NagSuppressions for specific issues
import { applyNagSuppressions } from "../lib/nag-suppressions";

// Apply suppressions after stacks are constructed (and before synth)
const stacks = app.node.children.filter((child) => child instanceof cdk.Stack);
for (const stack of stacks) {
  if (stack instanceof RapidStack) {
    applyNagSuppressions(stack);
  }
}
