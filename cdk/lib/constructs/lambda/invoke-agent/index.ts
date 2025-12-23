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
 * Middleware to inject custom X-Ray trace ID for each review item.
 * 
 * Problem: Step Functions generates a single trace ID for the entire execution,
 * causing all review items (Map state iterations) to share the same trace in
 * CloudWatch GenAI Observability, making it difficult to analyze individual items.
 * 
 * Solution: Override the X-Ray trace ID with a unique value derived from reviewResultId
 * for each InvokeAgentRuntime call. This creates separate traces per review item
 * while maintaining a single AgentCore session (via shared runtimeSessionId).
 * 
 * Result: CloudWatch GenAI Observability displays:
 * - 1 session (all items share the same reviewJobId-based session)
 * - N traces (one per review item, each with unique trace ID)
 * 
 * X-Ray Trace ID Format: Root=1-{hex-timestamp}-{24-char-hex-id}
 * - timestamp: Current Unix time in hexadecimal
 * - id: Derived from reviewResultId (UUID without hyphens, truncated to 24 chars)
 */
client.middlewareStack.add(
  (next, context) => async (args: any) => {
    // Extract reviewResultId from payload for unique trace ID generation
    const payload = JSON.parse(args.request.body);
    const reviewResultId = payload.reviewResultId || '';
    
    // Generate unique trace ID based on reviewResultId
    // Remove hyphens from UUID and take first 24 characters for X-Ray format
    const traceId = reviewResultId.replace(/-/g, '').substring(0, 24);
    const timestamp = Math.floor(Date.now() / 1000).toString(16);
    const customTraceId = `Root=1-${timestamp}-${traceId}`;
    
    // Override the X-Ray trace ID header that would normally be propagated from Step Functions
    args.request.headers['X-Amzn-Trace-Id'] = customTraceId;
    
    console.log(`[TRACE] Injected custom trace ID: ${customTraceId} for reviewResultId: ${reviewResultId}`);
    
    return await next(args);
  },
  {
    step: 'build',
    name: 'injectCustomTraceId',
  }
);

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

    // Use same session ID for all review items in the same job
    const runtimeSessionId = event.reviewJobId.padEnd(33, "0");
    console.log(`[SESSION] Using runtimeSessionId: ${runtimeSessionId} for reviewJobId: ${event.reviewJobId}, reviewResultId: ${event.reviewResultId}`);

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
