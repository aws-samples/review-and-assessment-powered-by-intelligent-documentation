import { Handler } from "aws-lambda";
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import { StepFunctionsInput, AgentPayload } from "./types";

class RetryException extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
  ) {
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
 * for each InvokeAgentRuntime call. Combined with the per-item runtimeSessionId
 * (see the [SESSION] block in the handler), each review item gets its own
 * AgentCore session and its own trace.
 *
 * Result: CloudWatch GenAI Observability displays:
 * - N sessions (one per review item; session IDs share the reviewJobId prefix,
 *   so all sessions of a job can still be found by prefix search)
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
    const reviewResultId = payload.reviewResultId || "";

    // Generate unique trace ID based on reviewResultId
    // Remove hyphens from UUID and take first 24 characters for X-Ray format
    const traceId = reviewResultId.replace(/-/g, "").substring(0, 24);
    const timestamp = Math.floor(Date.now() / 1000).toString(16);
    const customTraceId = `Root=1-${timestamp}-${traceId}`;

    // Override the X-Ray trace ID header that would normally be propagated from Step Functions
    args.request.headers["X-Amzn-Trace-Id"] = customTraceId;

    console.log(
      `[TRACE] Injected custom trace ID: ${customTraceId} for reviewResultId: ${reviewResultId}`,
    );

    return await next(args);
  },
  {
    step: "build",
    name: "injectCustomTraceId",
  },
);

export const handler: Handler = async (event: StepFunctionsInput) => {
  // イベント全体（toolConfiguration / mcpServers に MCP 秘密を
  // 含みうる）を JSON ダンプしない。相関に必要な非機微スカラのみを記録する。
  console.log(
    `[EVENT] reviewJobId=${event.reviewJobId} checkId=${event.checkId} ` +
      `reviewResultId=${event.reviewResultId} ` +
      `documentPaths=${event.preItemResult?.Payload?.documentPaths?.length ?? 0} ` +
      `hasToolConfiguration=${event.preItemResult?.Payload?.toolConfiguration != null}`,
  );

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
      modelId: event.preItemResult.Payload.modelId,
    };

    // payload は toolConfiguration / mcpServers（MCP 秘密）を
    // 含むため全文をダンプしない。非機微なメタ情報のみ記録する。
    console.log(
      `[PAYLOAD] reviewResultId=${agentPayload.reviewResultId} ` +
        `documentPaths=${agentPayload.documentPaths?.length ?? 0} ` +
        `modelId=${agentPayload.modelId ?? "default"} ` +
        `hasToolConfiguration=${agentPayload.toolConfiguration != null}`,
    );

    // セッション ID は「審査項目ごと」に分離する（reviewJobId + reviewResultId）。
    //
    // 旧実装は 1 ジョブ = 1 セッション（reviewJobId のみ）を全項目で共有していたが、
    // AgentCore Runtime は 1 セッション = 1 microVM であり、同一セッションへの
    // 同時呼び出しは AWS のガイダンス上もアプリ層で直列化すべきものになっている。
    // 実際、未作成セッションへの同時初回呼び出しは microVM プロビジョニングの
    // 競合（502）を起こし、さらに当時の bedrock-agentcore SDK 0.1.0 はコンテナ
    // あたり同時 2 呼び出しまでしか処理しなかったため（1.x で上限は撤廃済み）、
    // Map ステートの並列度（既定 5）超過分が "Server busy" として拒否され、
    // InvokeAgentRuntime に RuntimeClientError（"Received error (500) from
    // runtime"）が返り続けてジョブ全体が失敗していた。SDK の上限撤廃後も、
    // 1 台の microVM（上限 2vCPU/8GB）に重い文書処理を複数同時に載せる構成は
    // リソース競合のリスクが残る。
    // 審査項目は互いに独立で microVM 内に共有状態を持たないため、項目ごとに
    // セッションを分けることで同一セッションへの同時呼び出しを構造的に排除し、
    // 上記の故障モードをまとめて解消する。
    // 同一項目のリトライは同じセッション ID を再利用するため、再試行は
    // プロビジョニング済みの microVM に到達する。
    // ID 形式: ULID 26 文字 + "-" + ULID 26 文字 = 53 文字（API 制約は 33〜256 文字・
    // 英数と -_）。想定外に短い ID が来ても最小長を満たすよう padEnd で保険をかける。
    //
    // Use a per-review-item session ID (reviewJobId + reviewResultId).
    //
    // The previous implementation shared one session (reviewJobId only) across
    // all items of a job. An AgentCore session maps to a single microVM, and
    // AWS guidance says concurrent calls to one session should be serialized
    // at the application layer. In practice, concurrent first calls to a
    // not-yet-provisioned session raced the microVM provisioning (502), and
    // the bedrock-agentcore SDK 0.1.0 used at the time only processed 2
    // concurrent invocations per container (the cap was removed in 1.x), so
    // calls beyond the Map state concurrency (default 5) were rejected as
    // "Server busy", surfacing as persistent RuntimeClientError ("Received
    // error (500) from runtime") and failing the whole job. Even without the
    // SDK cap, stacking several heavy document-processing items onto one
    // microVM (max 2vCPU/8GB) risks resource contention.
    // Review items are independent and share no in-container state, so giving
    // each item its own session structurally eliminates concurrent calls to
    // the same session and all of the failure modes above. Retries of the
    // same item reuse the same session ID and therefore reach the
    // already-provisioned microVM.
    // Format: 26-char ULID + "-" + 26-char ULID = 53 chars (API allows 33-256
    // chars of alphanumerics, "-", "_"). padEnd guards the 33-char minimum in
    // case unexpectedly short IDs are ever passed.
    const runtimeSessionId =
      `${event.reviewJobId}-${event.reviewResultId}`.padEnd(33, "0");
    console.log(
      `[SESSION] Using runtimeSessionId: ${runtimeSessionId} for reviewJobId: ${event.reviewJobId}, reviewResultId: ${event.reviewResultId}`,
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
    // 成功時は本文全文をダンプせず長さのみ記録する。
    // 非 200（エラー診断が必要）時のみ本文を残す。
    if (response.statusCode === 200) {
      console.log(`AgentCore response body length: ${responseBody.length}`);
    } else {
      console.log("AgentCore response body (non-200):", responseBody);
    }

    // Check status code and throw error if not 200
    if (response.statusCode !== 200) {
      throw new Error(
        `AgentCore returned non-200 status: ${response.statusCode}`,
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
        error as Error,
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
