import { CfnOutput, Duration, Stack, RemovalPolicy } from "aws-cdk-lib";
import {
  UserPool,
  UserPoolClient,
  UserPoolDomain,
  AccountRecovery,
  StringAttribute,
  ClientAttributes,
  IUserPool,
  IUserPoolClient,
} from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";

/**
 * Auth コンストラクトに渡すプロパティ
 */
export interface AuthProps {
  /**
   * 既存のCognito UserPoolをインポートする場合のID
   */
  cognitoUserPoolId?: string;

  /**
   * 既存のCognito UserPool ClientをインポートするID
   */
  cognitoUserPoolClientId?: string;

  /**
   * Cognitoドメインのプレフィックス
   */
  cognitoDomainPrefix?: string;

  /**
   * Cognito User Poolのセルフサインアップを有効にするかどうか
   * @default true
   */
  cognitoSelfSignUpEnabled?: boolean;
}

export class Auth extends Construct {
  readonly userPool: UserPool | IUserPool;
  readonly client: UserPoolClient | IUserPoolClient;
  readonly userPoolDomain?: UserPoolDomain;

  constructor(scope: Construct, id: string, props?: AuthProps) {
    super(scope, id);

    // 既存のCognitoリソースのインポートかどうか判定
    const importUserPoolId = props?.cognitoUserPoolId;
    const importUserPoolClientId = props?.cognitoUserPoolClientId;
    const domainPrefix = props?.cognitoDomainPrefix;

    // UserPool & UserPoolClient の初期化
    const resources = this.initializeResources(
      importUserPoolId,
      importUserPoolClientId,
      props?.cognitoSelfSignUpEnabled
    );
    this.userPool = resources.userPool;
    this.client = resources.client;

    // ドメイン設定（オプション）
    if (domainPrefix && this.userPool instanceof UserPool) {
      this.userPoolDomain = this.createDomain(this.userPool, domainPrefix);
    }

    // 出力の設定
    this.createOutputs(importUserPoolId, importUserPoolClientId);
  }

  /**
   * Cognitoリソース（UserPool & Client）を初期化する
   * @returns 初期化されたリソース
   */
  private initializeResources(
    importUserPoolId?: string,
    importUserPoolClientId?: string,
    selfSignUpEnabled?: boolean
  ): {
    userPool: UserPool | IUserPool;
    client: UserPoolClient | IUserPoolClient;
  } {
    if (importUserPoolId) {
      return this.createImportedResources(
        importUserPoolId,
        importUserPoolClientId
      );
    } else {
      return this.createNewResources(selfSignUpEnabled);
    }
  }

  /**
   * 既存のCognitoリソースをインポートする
   */
  private createImportedResources(
    userPoolId: string,
    userPoolClientId?: string
  ): {
    userPool: UserPool | IUserPool;
    client: UserPoolClient | IUserPoolClient;
  } {
    console.log(`Importing existing Cognito User Pool: ${userPoolId}`);
    const userPool = UserPool.fromUserPoolId(
      this,
      "ImportedUserPool",
      userPoolId
    );

    let client: UserPoolClient | IUserPoolClient;
    if (userPoolClientId) {
      // 既存のClientをインポート
      console.log(
        `Importing existing Cognito User Pool Client: ${userPoolClientId}`
      );
      client = UserPoolClient.fromUserPoolClientId(
        this,
        "ImportedClient",
        userPoolClientId
      );
    } else {
      // インポートされたUserPoolに新しいClientを作成
      console.log(`Creating new client for imported User Pool`);
      client = this.createUserPoolClient(userPool as UserPool);
    }

    return { userPool, client };
  }

  /**
   * 新しいCognitoリソースを作成する
   */
  private createNewResources(selfSignUpEnabled?: boolean): {
    userPool: UserPool;
    client: UserPoolClient;
  } {
    const userPool = new UserPool(this, "UserPool", {
      passwordPolicy: {
        requireUppercase: true,
        requireSymbols: true,
        requireDigits: true,
        minLength: 8,
      },
      selfSignUpEnabled: selfSignUpEnabled ?? true,
      signInAliases: {
        username: false,
        email: true,
      },
      autoVerify: {
        email: true,
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      customAttributes: {
        rapid_role: new StringAttribute({ minLen: 0, maxLen: 2048 }),
      },
      removalPolicy: RemovalPolicy.DESTROY, // 開発環境用。本番環境ではRETAINを検討
    });

    // Add suppressions for Cognito requirements
    NagSuppressions.addResourceSuppressions(
      userPool,
      [
        {
          id: "AwsSolutions-COG2",
          reason:
            "MFA requirement is disabled for demo/POC environments to lower barriers for users",
        },
        {
          id: "AwsSolutions-COG3",
          reason:
            "Advanced Security Mode is deprecated due to the introduction of feature plans, so configuration is not required",
        },
      ],
      true
    );

    const client = this.createUserPoolClient(userPool);

    return { userPool, client };
  }

  /**
   * UserPoolClientを作成する
   */
  private createUserPoolClient(userPool: UserPool): UserPoolClient {
    const standardReadAttributes = { email: true, emailVerified: true };
    const standardWriteAttributes = { email: true };

    return userPool.addClient("Client", {
      idTokenValidity: Duration.days(1),
      accessTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      authFlows: {
        userPassword: true,
        userSrp: true,
        adminUserPassword: true,
      },
      readAttributes: new ClientAttributes()
        .withStandardAttributes(standardReadAttributes)
        .withCustomAttributes("rapid_role"),
      writeAttributes: new ClientAttributes().withStandardAttributes(
        standardWriteAttributes
      ),
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
    });
  }

  /**
   * Cognitoドメインを作成する
   */
  private createDomain(
    userPool: UserPool,
    domainPrefix: string
  ): UserPoolDomain {
    console.log(`Creating Cognito domain with prefix: ${domainPrefix}`);
    return userPool.addDomain("Domain", {
      cognitoDomain: {
        domainPrefix: domainPrefix,
      },
    });
  }

  /**
   * CloudFormation出力を作成する
   */
  private createOutputs(
    importUserPoolId?: string,
    importUserPoolClientId?: string
  ): void {
    // UserPool ID出力
    if (this.userPool instanceof UserPool) {
      new CfnOutput(this, "UserPoolId", { value: this.userPool.userPoolId });
    } else {
      new CfnOutput(this, "UserPoolId", {
        value: importUserPoolId || "Imported (ID not available)",
      });
    }

    // UserPoolClient ID出力
    if (this.client instanceof UserPoolClient) {
      new CfnOutput(this, "UserPoolClientId", {
        value: this.client.userPoolClientId,
      });
    } else {
      new CfnOutput(this, "UserPoolClientId", {
        value: importUserPoolClientId || "Imported (ID not available)",
      });
    }

    // ドメインURL出力
    if (this.userPoolDomain) {
      new CfnOutput(this, "UserPoolDomainUrl", {
        value: `https://${this.userPoolDomain.domainName}.auth.${
          Stack.of(this).region
        }.amazoncognito.com`,
      });
    }
  }
}
