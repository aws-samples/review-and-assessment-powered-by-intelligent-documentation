/**
 * Post-Generate Next Action Handler
 *
 * Saves the result from the Strands Agent to the database.
 */

import { getPrismaClient } from "../../api/core/db";
import { NEXT_ACTION_STATUS } from "../../api/features/review/domain/model/review";

declare const console: {
  log: (...data: any[]) => void;
  error: (...data: any[]) => void;
};

export interface PostGenerateNextActionParams {
  reviewJobId: string;
  agentResult: {
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
  };
}

export interface PostGenerateNextActionResult {
  success: boolean;
  status: NEXT_ACTION_STATUS;
  message?: string;
}

export async function postGenerateNextAction(
  params: PostGenerateNextActionParams
): Promise<PostGenerateNextActionResult> {
  const { reviewJobId, agentResult } = params;
  console.log(
    `[PostGenerateNextAction] Starting for reviewJobId: ${reviewJobId}`
  );

  const db = await getPrismaClient();

  try {
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

    // Save result to database
    await db.reviewJob.update({
      where: { id: reviewJobId },
      data: {
        nextAction: agentResult.nextAction,
        nextActionStatus: NEXT_ACTION_STATUS.COMPLETED,
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
