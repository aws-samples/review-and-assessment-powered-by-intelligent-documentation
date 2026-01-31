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

/**
 * Middleware to inject custom X-Ray trace ID for next action generation.
 *
 * Creates a unique trace ID based on reviewJobId for CloudWatch GenAI Observability.
 */
client.middlewareStack.add(
  (next) => async (args: any) => {
    const payload = JSON.parse(args.request.body);
    const reviewJobId = payload.reviewJobId || "";

    // Generate unique trace ID based on reviewJobId
    const traceId = reviewJobId.replace(/-/g, "").substring(0, 24);
    const timestamp = Math.floor(Date.now() / 1000).toString(16);
    const customTraceId = `Root=1-${timestamp}-${traceId}`;

    args.request.headers["X-Amzn-Trace-Id"] = customTraceId;

    console.log(
      `[TRACE] Injected custom trace ID: ${customTraceId} for reviewJobId: ${reviewJobId}`
    );

    return await next(args);
  },
  {
    step: "build",
    name: "injectCustomTraceId",
  }
);

export const handler: Handler = async (event: StepFunctionsInput) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    const prePayload = event.preGenerateResult.Payload;

    // Check if generation should be skipped
    if (!prePayload.shouldGenerate) {
      console.log("Next action generation skipped (shouldGenerate=false)");
      return {
        status: "skipped",
        nextAction: null,
        metrics: null,
      };
    }

    // Transform Step Functions payload to Agent payload format
    const agentPayload: AgentPayload = {
      reviewJobId: event.reviewJobId,
      promptTemplate: prePayload.promptTemplate,
      templateData: prePayload.templateData,
      toolConfiguration: prePayload.toolConfiguration,
    };

    console.log("Transformed payload:", JSON.stringify(agentPayload, null, 2));

    // Use reviewJobId-based session ID
    const runtimeSessionId = `nextaction-${event.reviewJobId}`.substring(0, 33);
    console.log(
      `[SESSION] Using runtimeSessionId: ${runtimeSessionId} for reviewJobId: ${event.reviewJobId}`
    );

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

    // Parse and return the response data
    const parsedResponse = JSON.parse(responseBody);
    return parsedResponse;
  } catch (error) {
    console.error("Error invoking NextActionAgent:", error);

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
