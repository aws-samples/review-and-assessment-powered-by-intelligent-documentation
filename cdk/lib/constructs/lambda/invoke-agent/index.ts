import { Handler } from "aws-lambda";
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import { StepFunctionsInput, AgentPayload } from "./types";

class RetryException extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "RetryException";
  }
}

const client = new BedrockAgentCoreClient({
  region: process.env.AWS_REGION,
});

export const handler: Handler = async (event: StepFunctionsInput) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    // Transform Step Functions payload to Agent payload format
    const agentPayload: AgentPayload = {
      reviewJobId: event.reviewJobId,
      checkId: event.checkId,
      reviewResultId: event.reviewResultId,
      documentPaths: event.preItemResult.Payload.documentPaths,
      checkName: event.preItemResult.Payload.checkName,
      checkDescription: event.preItemResult.Payload.checkDescription,
      feedbackSummary: event.preItemResult.Payload.feedbackSummary,
      languageName: event.preItemResult.Payload.languageName,
      mcpServers: event.preItemResult.Payload.mcpServers,
      toolConfiguration: event.preItemResult.Payload.toolConfiguration,
    };

    console.log("Transformed payload:", JSON.stringify(agentPayload, null, 2));

    // Transform reviewJobId to meet 33+ character requirement
    const runtimeSessionId = event.reviewJobId.padEnd(33, "0");

    // Call bedrock-agentcore:InvokeAgentRuntime
    const command = new InvokeAgentRuntimeCommand({
      agentRuntimeArn: process.env.AGENT_RUNTIME_ARN!,
      runtimeSessionId: runtimeSessionId,
      payload: JSON.stringify(agentPayload),
    });

    const response = await client.send(command);
    console.log("AgentCore response status:", response.statusCode);

    // Read the streaming response
    const responseBody = await streamToString(response.response);
    console.log("AgentCore response body:", responseBody);

    // Check status code and throw error if not 200
    if (response.statusCode !== 200) {
      throw new Error(
        `AgentCore returned non-200 status: ${response.statusCode}`
      );
    }

    // Parse and return the response data directly
    const parsedResponse = JSON.parse(responseBody);
    return parsedResponse;
  } catch (error) {
    console.error("Error invoking AgentCore:", error);

    // Check if error is retryable based on AWS SDK error codes
    if (isRetryableError(error)) {
      throw new RetryException(
        `Retryable error occurred: ${(error as Error).message}`,
        error as Error
      );
    }

    throw error;
  }
};

// Helper function to detect retryable errors
function isRetryableError(error: any): boolean {
  const retryableErrorCodes = [
    "ThrottlingException",
    "ThrottledException",
    "ServiceQuotaExceededException",
    "InternalServerException",
  ];

  return (
    retryableErrorCodes.includes(error.name) ||
    retryableErrorCodes.includes(error.code) ||
    (error.statusCode >= 500 && error.statusCode < 600)
  );
}

// Helper function to convert streaming response to string
async function streamToString(stream: any): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf-8");
}
