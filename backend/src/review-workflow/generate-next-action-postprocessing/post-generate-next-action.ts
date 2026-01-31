/**
 * Post-Generate Next Action Handler
 *
 * Saves the result from the Strands Agent to the database.
 */

import { getPrismaClient } from "../../api/core/db";
import { getS3Client } from "../../api/core/s3";
import { NEXT_ACTION_STATUS } from "../../api/features/review/domain/model/review";
import { S3TempStorage } from "../../utils/s3-temp";

declare const console: {
  log: (...data: any[]) => void;
  error: (...data: any[]) => void;
};

/** Agent result after resolving S3 temp reference */
interface ResolvedAgentResult {
  status: string;
  nextAction?: string | null;
  metrics?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    totalCost?: number;
    durationMs?: number;
    modelId?: string;
  };
  toolExecutions?: Array<{
    toolName: string;
    input: any;
    output: any;
    durationMs: number;
  }>;
}

export interface PostGenerateNextActionParams {
  reviewJobId: string;
  agentResult: ResolvedAgentResult | any; // Can be S3 temp reference or actual data
}

export interface PostGenerateNextActionResult {
  success: boolean;
  status: NEXT_ACTION_STATUS;
  message?: string;
}

export async function postGenerateNextAction(
  params: PostGenerateNextActionParams
): Promise<PostGenerateNextActionResult> {
  const { reviewJobId, agentResult: rawAgentResult } = params;
  console.log(
    `[PostGenerateNextAction] Starting for reviewJobId: ${reviewJobId}`
  );

  const db = await getPrismaClient();

  try {
    // Resolve S3 temp reference if needed
    const s3TempStorage = new S3TempStorage(
      getS3Client(),
      process.env.TEMP_BUCKET || ""
    );
    const agentResult: ResolvedAgentResult =
      await s3TempStorage.resolve(rawAgentResult);

    console.log(
      `[PostGenerateNextAction] Resolved agent result status: ${agentResult.status}`
    );

    // Handle skipped case
    if (agentResult.status === "skipped") {
      console.log(`[PostGenerateNextAction] Agent reported skipped status`);
      return {
        success: true,
        status: NEXT_ACTION_STATUS.SKIPPED,
        message: "Next Action generation was skipped",
      };
    }

    // Handle error case
    if (agentResult.status !== "success") {
      console.error(
        `[PostGenerateNextAction] Agent returned error status: ${agentResult.status}`
      );

      await db.reviewJob.update({
        where: { id: reviewJobId },
        data: {
          nextActionStatus: NEXT_ACTION_STATUS.FAILED,
          updatedAt: new Date(),
        },
      });

      return {
        success: false,
        status: NEXT_ACTION_STATUS.FAILED,
        message: `Agent returned status: ${agentResult.status}`,
      };
    }

    // Log metrics if available
    if (agentResult.metrics) {
      const { inputTokens, outputTokens, totalCost, durationMs, modelId } =
        agentResult.metrics;
      console.log(
        `[PostGenerateNextAction] Metrics - Model: ${modelId}, Tokens: ${inputTokens}/${outputTokens}, Cost: $${totalCost?.toFixed(4) ?? "N/A"}, Duration: ${durationMs}ms`
      );
    }

    // Log tool executions if available
    if (agentResult.toolExecutions?.length) {
      console.log(
        `[PostGenerateNextAction] Tool executions: ${agentResult.toolExecutions.length}`
      );
      for (const exec of agentResult.toolExecutions) {
        console.log(`  - ${exec.toolName}: ${exec.durationMs}ms`);
      }
    }

    // Get current cost values to add NextAction costs
    const currentJob = await db.reviewJob.findUnique({
      where: { id: reviewJobId },
      select: {
        totalCost: true,
        totalInputTokens: true,
        totalOutputTokens: true,
      },
    });

    const nextActionInputTokens = agentResult.metrics?.inputTokens ?? 0;
    const nextActionOutputTokens = agentResult.metrics?.outputTokens ?? 0;
    const nextActionCost = agentResult.metrics?.totalCost ?? 0;

    // Save result to database with accumulated costs
    await db.reviewJob.update({
      where: { id: reviewJobId },
      data: {
        nextAction: agentResult.nextAction,
        nextActionStatus: NEXT_ACTION_STATUS.COMPLETED,
        // Add NextAction costs to existing totals
        totalInputTokens:
          (currentJob?.totalInputTokens ?? 0) + nextActionInputTokens,
        totalOutputTokens:
          (currentJob?.totalOutputTokens ?? 0) + nextActionOutputTokens,
        totalCost: Number(currentJob?.totalCost ?? 0) + nextActionCost,
        updatedAt: new Date(),
      },
    });

    console.log(`[PostGenerateNextAction] Completed successfully`);

    return {
      success: true,
      status: NEXT_ACTION_STATUS.COMPLETED,
    };
  } catch (error) {
    console.error(`[PostGenerateNextAction] Error:`, error);

    // Update status to failed
    await db.reviewJob.update({
      where: { id: reviewJobId },
      data: {
        nextActionStatus: NEXT_ACTION_STATUS.FAILED,
        updatedAt: new Date(),
      },
    });

    return {
      success: false,
      status: NEXT_ACTION_STATUS.FAILED,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
