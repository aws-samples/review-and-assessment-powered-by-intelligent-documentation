#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AwsSecurityAuditGatewayStack } from '../lib/aws-security-audit-gateway-stack';

const app = new cdk.App();

new AwsSecurityAuditGatewayStack(app, 'AwsSecurityAuditGatewayStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-west-2',
  },
  description: 'AWS Security Audit Gateway using MCP and aws-api-mcp-server',
});
