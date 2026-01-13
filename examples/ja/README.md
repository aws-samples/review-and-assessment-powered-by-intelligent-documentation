# 日本語ユースケース

## ユースケース008: AWSセキュリティ監査

### 概要

AWS環境のセキュリティ設定が社内セキュリティ基準を満たしているかを確認するユースケース。
情報システム部門がDX推進部などからのAWSアカウント利用申請を審査する際に使用。

### MCP設定（aws-api-mcp-server）

Tool Configuration画面で以下を追加:

```json
{
  "mcpServers": {
    "aws-api": {
      "command": "uvx",
      "args": ["mcp-server-aws-api"]
    }
  }
}
```

### 重要: AgentCore RuntimeへのIAM権限付与

このユースケースを実施するには、**AgentCore Runtime（Lambda実行ロール）** に以下のIAM読み取り権限が必要です：

- rds:DescribeDBInstances
- s3:ListBuckets, s3:GetPublicAccessBlock
- iam:ListUsers, iam:ListMFADevices, iam:GetAccountPasswordPolicy
- cloudtrail:DescribeTrails, cloudtrail:GetTrailStatus
- ec2:DescribeVpcs, ec2:DescribeFlowLogs, ec2:DescribeSecurityGroups, ec2:DescribeVolumes
- config:DescribeConfigurationRecorders, config:DescribeConfigurationRecorderStatus
- guardduty:ListDetectors, guardduty:GetDetector

詳細: https://github.com/awslabs/mcp/tree/main/src/aws-api-mcp-server
