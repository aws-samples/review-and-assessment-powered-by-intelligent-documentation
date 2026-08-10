# デプロイオプション

このドキュメントでは、RAPID のデプロイと設定のオプションを詳しく説明します。基本的なデプロイ手順とパラメータの一覧表は [README](./README_ja.md#デプロイ方法) をご覧ください。

## 目次

- [CloudShell デプロイのオプション](#cloudshell-デプロイのオプション)
- [閉域網デプロイ](#閉域網デプロイ)
- [AI モデルのカスタマイズ](#ai-モデルのカスタマイズ)
- [後片付けの詳細](#後片付けの詳細)

## CloudShell デプロイのオプション

CloudShell 用のデプロイスクリプト（`bin.sh`）では、以下のオプションを利用できます。値はオプション名のあとにスペース区切りで指定してください。

```bash
wget -O - https://raw.githubusercontent.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation/main/bin.sh | bash -s -- --ipv4-ranges '["192.168.0.0/16"]' --cognito-self-signup false
```

ほとんどのオプションは、[パラメータカスタマイズ](./README_ja.md#パラメータカスタマイズ)で説明する CDK パラメータにそのまま対応しています。各パラメータの意味は README の一覧表をご覧ください。

| オプション                            | 説明                                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `--ipv4-ranges`                  | フロントエンド WAF で許可する IPv4 アドレス範囲を指定します（JSON 配列形式）。`allowedIpV4AddressRanges` に対応します。                                        |
| `--ipv6-ranges`                  | フロントエンド WAF で許可する IPv6 アドレス範囲を指定します（JSON 配列形式）。`allowedIpV6AddressRanges` に対応します。                                        |
| `--auto-migrate`                 | デプロイ時に自動的にデータベースマイグレーションを実行するかどうかを指定します（true/false）。`autoMigrate` に対応します。                                                 |
| `--cognito-self-signup`          | Cognito User Pool のセルフサインアップを有効にするかどうかを指定します（true/false）。`cognitoSelfSignUpEnabled` に対応します。                              |
| `--cognito-user-pool-id`         | 既存の Cognito User Pool ID を指定します（指定しない場合は新規作成します）。`cognitoUserPoolId` に対応します。                                              |
| `--cognito-user-pool-client-id`  | 既存の Cognito User Pool Client ID を指定します（指定しない場合は新規作成します）。`cognitoUserPoolClientId` に対応します。                                 |
| `--cognito-domain-prefix`        | Cognito ドメインのプレフィックスを指定します（指定しない場合は自動生成します）。`cognitoDomainPrefix` に対応します。                                                  |
| `--mcp-admin`                    | MCP ランタイム Lambda 関数に管理者権限を付与するかどうかを指定します（true/false、既定: false）。`mcpAdmin` に対応します。              |
| `--s3-api-gateway-frontend`      | CloudFront の代わりに専用の REGIONAL API Gateway（S3 プロキシ）で SPA を配信するかどうかを指定します（true/false、既定: false）。`s3ApiGatewayFrontend` に対応します。 |
| `--closed-network`               | 完全閉域モードでデプロイするかどうかを指定します（true/false、既定: false）。`closedNetwork` に対応します。詳細は[閉域網デプロイ](#閉域網デプロイ)をご覧ください。                     |
| `--agentcore-network-mode`       | 閉域時の AgentCore Runtime のネットワークモードを `PUBLIC` または `VPC` で指定します（既定: PUBLIC）。`agentCoreNetworkMode` に対応します。               |
| `--bedrock-region`               | Amazon Bedrock を利用するリージョンを指定します（既定: us-west-2）。`bedrockRegion` に対応します。                                              |
| `--document-model`               | ドキュメント処理に使う AI モデル ID を指定します（既定: global.anthropic.claude-sonnet-4-6）。`documentProcessingModelId` に対応します。              |
| `--image-model`                  | 画像審査に使う AI モデル ID を指定します（既定: global.anthropic.claude-sonnet-4-6）。`imageReviewModelId` に対応します。                          |
| `--disable-ipv6`                 | フロントエンド WAF と CloudFront の IPv6 サポートを無効にします。                                                                          |
| `--repo-url`                     | デプロイするリポジトリの URL を指定します。                                                                                                  |
| `--branch`                       | デプロイするブランチ名を指定します。                                                                                                        |
| `--tag`                          | デプロイする特定の Git タグを指定します。                                                                                                   |

> [!Note]
> 旧オプション `--document-model` と `--image-model` は非推奨であり、将来のリリースで削除されます。後方互換のため引き続き受け付けますが、いずれも単一の `defaultModelId` パラメータに統合されました。代わりに `--default-model` を使用してください。

## 閉域網デプロイ

次の 2 つのパラメータで、フロントエンドの配信方式とネットワークトポロジを切り替えられます。

- `s3ApiGatewayFrontend: true` — CloudFront の代わりに専用の **REGIONAL API Gateway（S3 プロキシ）** で SPA を配信します。SPA は `/app/` ステージパス配下で配信され、同じ IP 許可リストを持つ REGIONAL WAF が配信ステージを保護します。アプリケーションは公開されたままなので、CloudFront を利用できない環境で使用してください。
- `closedNetwork: true` — 完全閉域構成にします。VPC は **isolated サブネットのみ（NAT／インターネットゲートウェイなし）** で構成され、実行時の AWS アクセス（Bedrock、S3、SQS、Step Functions、Secrets Manager、CloudWatch Logs、Cognito など）はすべて **VPC エンドポイント** 経由になります。フロントエンド配信 API とバックエンド API はいずれも **PRIVATE API Gateway** となり、リソースポリシーによってスタックの `execute-api` VPC エンドポイント経由のリクエストのみを受け付けます（`aws:SourceVpce`）。このモードは `s3ApiGatewayFrontend` の設定値にかかわらず S3 + API Gateway 配信を含意します。

パラメータは通常どおりの方法で設定できます。`cdk/lib/parameter.ts` で設定する場合:

```typescript
export const parameters = {
  // ...
  closedNetwork: true,
};
```

デプロイ時に CLI context で指定する場合:

```bash
npx cdk deploy --all -c rapid.closedNetwork=true
```

CloudShell スクリプトのオプションで指定する場合:

```bash
./bin.sh --closed-network true
```

閉域モードを有効化する前に、以下の特性・制約をご確認ください。

- **デプロイの実行時にはインターネットアクセスが必要です。** コンテナイメージと SPA アセットのビルドはデプロイ時（CodeBuild またはローカルマシン）に行われ、依存パッケージをインターネットから取得します。`closedNetwork` が分離するのは**実行時**の通信経路であり、デプロイ処理自体ではありません。
- **アプリケーションへのアクセスは VPC 内部からに限定されます。** 例えば VPC 内のブラウザ付き EC2 インスタンスからアクセスするか、AWS Client VPN・AWS Site-to-Site VPN・AWS Direct Connect で VPC に接続したオンプレミスのネットワークからアクセスします。PRIVATE API Gateway にはインターネットから到達できません。
- **認証は PrivateLink 経由の Cognito で、SRP（ユーザー名／パスワード）方式のみ利用できます。** Cognito の Hosted UI・OAuth フロー・外部 IdP フェデレーションは、インターネット向けの Cognito ドメインに依存するため閉域では利用できません。なお、Cognito の PrivateLink は AWS GovCloud では利用できません。
- **`agentCoreNetworkMode` にはトレードオフがあります。** `PUBLIC`（既定）では AgentCore Runtime は AWS 管理ネットワークで動作します。MCP ツール（stdio／公開 HTTP）や `uv` / `npx` による実行時のパッケージ取得は引き続き動作し、VPC からの Invoke 経路は Bedrock AgentCore VPC エンドポイント経由でプライベートに保たれます。`VPC` にすると Runtime 自体が isolated サブネットへ移動して分離が最大化されますが、これらのツールはインターネットに到達できなくなり、`cdk destroy` 時に ENI の解放待ちが最大 8 時間程度発生します（[後片付けの詳細](#後片付けの詳細)参照）。
- **既存スタックでの `closedNetwork` 切り替えは VPC の置換を伴います。** インプレース変更ではなく、Aurora クラスターを含む依存リソースが再作成されます。閉域構成は**新規スタック**（別アカウントまたは別リージョン）としてデプロイし、事前に `cdk diff` を実行のうえ、データを保持する既存環境に触れる場合は Aurora のスナップショットを取得してください。
- **`global.` 推論プロファイルはリージョン外へルーティングされる可能性があります。** `global.` プレフィックスのクロスリージョン推論プロファイルは、推論トラフィックをデプロイリージョン外へルーティングすることがあります（閉域モードでは合成時に警告を出力します）。厳密なデータレジデンシー要件がある場合は、リージョン固定のプロファイル（例: `jp.`）を使用してください。
- **インフラ固定費は既定構成より高くなります。** 閉域モードでは NAT Gateway が不要になる一方、約 19 個のインターフェイス型 VPC エンドポイントが最大 2 つのアベイラビリティゾーンに作成されます。インターフェイス型エンドポイントにはエンドポイントごと・AZ ごとの時間課金とデータ処理料金が発生するため、固定費は [README](./README_ja.md#料金について) に記載した既定構成の目安を上回ります。目安として、2 AZ の場合エンドポイントだけで 1 日あたり約 9〜13 USD です（リージョンにより変動します）。詳細は [AWS PrivateLink の料金](https://aws.amazon.com/privatelink/pricing/)をご覧ください。

## AI モデルのカスタマイズ

このアプリケーションは Strands エージェントがファイル読み込みなどのツールを使用するため、**ツール使用に対応したモデル**を選択する必要があります。

**ツール使用対応モデルの例**（`availableModels` に既定で含まれるモデル）:

- `global.anthropic.claude-sonnet-5` (Claude Sonnet 5, Global) — 既定
- `global.anthropic.claude-opus-4-8` (Claude Opus 4.8, Global)
- `jp.anthropic.claude-opus-4-8` (Claude Opus 4.8, JP)
- `global.anthropic.claude-opus-4-7` (Claude Opus 4.7, Global)
- `jp.anthropic.claude-opus-4-7` (Claude Opus 4.7, JP)
- `global.anthropic.claude-opus-4-6-v1` (Claude Opus 4.6, Global)
- `global.anthropic.claude-sonnet-4-6` (Claude Sonnet 4.6, Global)
- `jp.anthropic.claude-sonnet-4-6` (Claude Sonnet 4.6, JP)
- `global.anthropic.claude-haiku-4-5-20251001-v1:0` (Claude Haiku 4.5, Global)
- `jp.anthropic.claude-haiku-4-5-20251001-v1:0` (Claude Haiku 4.5, JP)

**重要な注意事項**:

- **クロスリージョン推論プロファイル**: クロスリージョン推論を利用する場合は、モデル ID に地域プレフィックス（`global.`、`us.`、`eu.`、`apac.`、`jp.`）が必須で、プレフィックスはスタック（Amazon Bedrock）をデプロイするリージョンと整合している必要があります。例えば **us-east-1** のデプロイで `jp.*` モデルを選択すると、`ValidationException: The provided model identifier is invalid.` で失敗します。なお、本サンプル同梱の `availableModels` リストには `global.` / `jp.` の推論プロファイルのみが含まれます。デプロイ先リージョンで `us.` / `eu.` / `apac.` などが必要な場合はご自身で追加してください。
- **公式ドキュメント**: [Amazon Bedrock でサポートされているモデルと機能](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-supported-models-features.html) / [Amazon Bedrock のモデルカード](https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.html)

**設定例（日本国内で推論を行う場合）**: `cdk/lib/parameter.ts` を次のように編集します。Amazon Bedrock はスタックをデプロイしたリージョンのものを使用するため、`jp.` の推論プロファイルを使う場合は、スタックを日本国内のリージョン（東京リージョン `ap-northeast-1`）にデプロイしてください（例: デプロイ前に `CDK_DEFAULT_REGION=ap-northeast-1` を設定します）。

```typescript
export const parameters = {
  defaultModelId: "jp.anthropic.claude-sonnet-4-6", // Claude Sonnet 4.6 (JP)
  // ...
};
```

### チェックリスト項目ごとのモデル選択

デフォルトでは、各チェックリスト項目に `availableModels` リストから特定の AI モデルを割り当てることができます。項目にモデルが選択されていない場合、審査は `defaultModelId` にフォールバックします（モデルはマルチモーダルのため、ドキュメントと画像で同じ既定値を使用します）。これにより、精度が必要な項目にだけ高精度モデルを使い、それ以外には安価なモデルを使う、といった使い分けができます。

利用可能なモデルをカスタマイズするには、`cdk/lib/parameter.ts` に必要なモデルを列挙します。

```typescript
export const parameters = {
  availableModels: [
    { modelId: "global.anthropic.claude-sonnet-5", displayName: "Claude Sonnet 5 (Global)" },
    { modelId: "jp.anthropic.claude-haiku-4-5-20251001-v1:0", displayName: "Claude Haiku 4.5 (JP)" },
    // ... 必要なモデルを追加してください
  ],
};
```

モデル選択 UI を完全に無効にするには、`availableModels` を空配列に設定します。

```typescript
export const parameters = {
  availableModels: [],
};
```

### モデルを追加する際の単価の登録

RAPID は、1 回の審査あたりの金額の目安を Web UI に表示します。この金額は、各モデルの単価（トークンあたりの料金）をもとに算出しています。これらの単価は別のファイル `review-item-processor/model_config.py`（`_MODEL_REGISTRY` という辞書）で管理しています。`availableModels` に新しいモデルを追加する場合（または既定モデルとして設定する場合）は、このファイルにもそのモデルの入力・出力トークンの単価を登録してください。単価が未登録のモデルは、単価が `0` の既定設定にフォールバックし、そのモデルの推定金額は `$0` と表示されます。

既存のエントリを参考に、`review-item-processor/model_config.py` へモデル ID をキーとしたエントリを追加します。

```python
_MODEL_REGISTRY = {
    # ...
    "global.anthropic.claude-sonnet-5": ModelConfig(
        model_id="global.anthropic.claude-sonnet-5",
        display_name="Claude Sonnet 5 (Global)",
        input_per_1m=3.0,    # 入力 1,000,000 トークンあたりの単価（USD）
        output_per_1m=15.0,  # 出力 1,000,000 トークンあたりの単価（USD）
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    # ...
}
```

Bedrock 上の各モデルのトークン単価は、[Amazon Bedrock 料金ページ](https://aws.amazon.com/bedrock/pricing/)をご参照ください。`input_per_1m` / `output_per_1m` は 1,000,000（1M）トークンあたりの単価で、料金ページの表記と揃えているため、値をそのまま登録できます（例: 入力 100 万トークンあたり `$3.00` の場合は `input_per_1m=3.0` になります）。

## 後片付けの詳細

[README](./README_ja.md#後片付けスタックの削除) に記載のとおり、`npx cdk destroy --all` で 2 つの CDK スタックを削除できます。このセクションでは、自動では削除**されない**ものと、既知の `DELETE_FAILED` のケースを説明します。

### 自動では削除されないリソース

- **インポートした Amazon Cognito User Pool**（`cognitoUserPoolId` を指定してデプロイした場合のみ）: スタックの管理対象ではなく参照しているだけのため、destroy してもプールとそのユーザーは残ります（意図した挙動です）。
- 一部の **CloudWatch Logs** ロググループ（Step Functions、VPC フローログ、審査キューコンシューマ）や、CDK ブートストラップの **ECR** リポジトリにプッシュされたコンテナイメージが残る場合があります。
- **CloudShell** 経由でデプロイした場合、補助スタック `RapidCodeBuildDeploy`（[`deploy.yml`](../../deploy.yml) 由来）は CDK アプリとは別物で、`cdk destroy` では削除されません。広範な `AdministratorAccess` を持つ CodeBuild ロールを残さないよう、CloudFormation コンソール／CLI から削除してください。

  ```bash
  aws cloudformation delete-stack --stack-name RapidCodeBuildDeploy
  ```

### `cdk destroy` が VPC のサブネット／セキュリティグループで `DELETE_FAILED` になる場合（VPC モード時のみ）

> [!Tip]
> この問題は `agentCoreNetworkMode` を `"VPC"` に設定した場合にのみ発生します。デフォルト設定（`"PUBLIC"`）では VPC 内に ENI を作成しないため、`cdk destroy --all` は即座に完了します。

VPC モードで実行している場合、審査エージェントは Amazon Bedrock AgentCore Runtime を使い、AgentCore が `RapidStack` のプライベートサブネット内にサービス管理の Elastic Network Interface（ENI、インターフェースタイプ `agentic_ai`、タグ `AmazonBedrockAgentCoreManaged=true`）を作成します。スタックを destroy すると、CloudFormation は AgentCore Runtime の削除には成功しますが、**これらの ENI がすぐには解放されない**ため、サブネットと審査プロセッサ用セキュリティグループがまだ削除できず、`The subnet '...' has dependencies and cannot be deleted`（サブネットに依存関係があり削除できない）や `resource sg-... has a dependent object`（SG に依存オブジェクトがある）といったメッセージとともにスタックが `DELETE_FAILED` で終わります。

これは不具合ではなく、想定どおりの挙動です。AWS のドキュメントには次のように記載されています。

> ENIs are shared resources across agents that use the same subnet and security group configuration. When you delete an agent, the associated ENI may persist in your VPC for up to 8 hours before it is automatically removed.
>
> （訳: ENI は、同じサブネットとセキュリティグループ構成を使うエージェント間で共有されるリソースです。エージェントを削除しても、関連する ENI は自動的に削除されるまで最大 8 時間 VPC 内に残存することがあります。）
>
> — [Configure Amazon Bedrock AgentCore Runtime and tools for VPC](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-vpc.html)

これらの ENI は AgentCore のサービスリンクロール `AWSServiceRoleForBedrockAgentCoreNetwork`（[ドキュメント](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/service-linked-roles.html)）によって作成・削除されるため、**自分でデタッチや削除はできません**。また `cdk destroy` を再実行しても同じ理由で失敗し続けます。**最大 8 時間程度待ってから、**`cdk destroy --all` を再実行してください。

この待機を回避したい場合は、`cdk/lib/parameter.ts` で `agentCoreNetworkMode: "PUBLIC"` に設定し、destroy 前に再デプロイしてください。
