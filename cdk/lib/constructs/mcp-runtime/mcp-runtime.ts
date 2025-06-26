import * as path from "path";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaPython from "@aws-cdk/aws-lambda-python-alpha";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import { Duration } from "aws-cdk-lib";
import { OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";

/**
 * Properties for the McpRuntime construct
 */
export interface McpRuntimeProps {
  /**
   * Optional timeout duration for Lambda functions
   */
  timeout?: Duration;
  /**
   * Optional flag to grant Administrator access to the Lambda functions.
   */
  admin?: boolean;
}

/**
 * MCP Runtime construct that creates Python and TypeScript Runtime for Local MCP Servers
 */
export class McpRuntime extends Construct {
  /**
   * Reference to the Python time server Lambda function
   */
  public readonly pythonMcpServer: lambdaPython.PythonFunction;

  /**
   * Reference to the TypeScript time server Lambda function
   */
  public readonly typescriptMcpServer: lambdaNode.NodejsFunction;

  constructor(scope: Construct, id: string, props: McpRuntimeProps = {}) {
    super(scope, id);

    // Set default timeout if not provided
    const timeout = props.timeout || Duration.seconds(60);

    this.pythonMcpServer = new lambdaPython.PythonFunction(
      this,
      "pythonMcpServer",
      {
        runtime: lambda.Runtime.PYTHON_3_13,
        handler: "handler",
        entry: path.join(__dirname, "python"),
        timeout: timeout,
        environment: {
          PATH: "/var/task/bin:/opt/bin:/usr/local/bin:/usr/bin:/bin",
        },
        memorySize: 1024,
        architecture: lambda.Architecture.ARM_64,
        bundling: {
          command: [
            "bash", "-c",
            "pip install poetry && poetry export -f requirements.txt > /asset-output/requirements.txt && pip install -r /asset-output/requirements.txt"
          ],
        },
      }
    );

    const tsDir = path.join(__dirname, "typescript");
    const tarball = "aws-run-mcp-servers-with-aws-lambda-0.2.1.tgz";

    this.typescriptMcpServer = new lambdaNode.NodejsFunction(
      this,
      "typescriptMcpServer",
      {
        entry: path.join(__dirname, "typescript", "handler.ts"),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        timeout: timeout,
        bundling: {
          minify: true,
          sourceMap: true,
          nodeModules: ["@aws/run-mcp-servers-with-aws-lambda", "npm"],
          format: OutputFormat.ESM,
          target: "node22",
        },
        environment: {
          NODE_OPTIONS: "--enable-source-maps",
          PATH: "/var/task/node_modules/.bin:/var/lang/bin:/opt/bin:/usr/local/bin:/usr/bin:/bin",
        },
        depsLockFilePath: path.join(
          __dirname,
          "typescript",
          "package-lock.json"
        ),

        memorySize: 1024,
      }
    );

    if (props.admin) {
      [this.pythonMcpServer.role, this.typescriptMcpServer.role].forEach(
        (role) => {
          role?.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")
          );
        }
      );
    }
  }
}
