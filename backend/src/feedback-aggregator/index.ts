/**
 * FEEDBACK AGGREGATOR - EXPERIMENTAL BETA FEATURE
 *
 * This module aggregates user feedback on AI review results and generates summaries
 * using Amazon Bedrock. It is implemented as a self-contained Lambda function rather
 * than following the repository/use-case layer pattern because it is an experimental
 * beta feature.
 *
 * ARCHITECTURE OVERVIEW:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ EventBridge (Daily 2:00 UTC)                                    │
 * └────────────────────┬────────────────────────────────────────────┘
 *                      │ Trigger
 *                      ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Lambda: Feedback Aggregator                                     │
 * │                                                                 │
 * │  1. Query DB for checklists with new feedback                  │
 * │     ├─ user_override = true                                    │
 * │     ├─ user_comment IS NOT NULL                                │
 * │     └─ updated_at > last_summary_update (or NULL for initial)  │
 * │                                                                 │
 * │  2. For each checklist:                                        │
 * │     ├─ Fetch feedback (all if initial, new if incremental)     │
 * │     │   └─ Initial run: max 100 feedbacks (memory limit)       │
 * │     ├─ Build context with complete feedback blocks             │
 * │     │   ├─ Reserve 200 tokens for system prompt                │
 * │     │   ├─ Add checklist info (name, description)              │
 * │     │   ├─ Add previous summary (if exists)                    │
 * │     │   └─ Add feedback blocks until token budget (189.8k)     │
 * │     │       Each block: userComment + extractedText + explanation │
 * │     │       (no truncation, complete blocks only)              │
 * │     ├─ Count tokens using Bedrock CountTokens API              │
 * │     │   └─ Model: anthropic.claude-sonnet-4 (single-region)    │
 * │     ├─ Generate summary via Bedrock InvokeModel                │
 * │     │   └─ Model: global.anthropic.claude-sonnet-4 (cross-region) │
 * │     └─ Update checklist.feedback_summary in DB                 │
 * │                                                                 │
 * │  3. Return processing statistics                               │
 * └─────────────────────────────────────────────────────────────────┘
 *                      │
 *                      ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Amazon Bedrock (Claude Sonnet 4)                                │
 * │ - Analyzes feedback patterns                                    │
 * │ - Generates actionable guidance for future reviews              │
 * │ - Auto-retry via AWS SDK (max 3 attempts)                       │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * INPUT DATA FLOW:
 *
 * ReviewResult (DB) ──┐
 *   ├─ userComment    │
 *   ├─ extractedText  ├──> buildContext() ──> AI Prompt
 *   ├─ explanation    │
 *   └─ result         │
 *                     │
 * CheckList (DB) ─────┤
 *   ├─ name           │
 *   ├─ description    │
 *   └─ feedbackSummary (previous) ──┘
 *
 * OUTPUT:
 * CheckList.feedbackSummary (updated)
 * CheckList.feedbackSummaryUpdatedAt (timestamp)
 *
 * TOKEN BUDGET:
 * - Total: 190,000 tokens (95% of Claude Sonnet 4's 200k context)
 * - System prompt: 200 tokens (reserved)
 * - Available for context: 189,800 tokens
 *
 * EXCEPTION TO ARCHITECTURE:
 * - Database access: Uses Prisma directly (not through repository layer)
 * - Bedrock client: Instantiated in this module (not through service layer)
 *
 * @module feedback-aggregator
 * @experimental
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  CountTokensCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { PrismaClient } from "../../prisma/client";
import { getDatabaseUrl } from "../utils/database";

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/** Default AI model for generating feedback summaries (cross-region inference) */
const DEFAULT_SUMMARY_MODEL_ID =
  "global.anthropic.claude-sonnet-4-20250514-v1:0";

/** Model ID for CountTokens API (must be single-region, no prefix) */
const COUNT_TOKENS_MODEL_ID = "anthropic.claude-sonnet-4-20250514-v1:0";

/** Maximum tokens to include in AI context (input limit) - 95% of Claude Sonnet 4's 200k context window */
const DEFAULT_MAX_CONTEXT_TOKENS = 190000;

/** Maximum tokens for AI summary output */
const MAX_SUMMARY_OUTPUT_TOKENS = 500;

/** Anthropic API version for Bedrock */
const ANTHROPIC_VERSION = "bedrock-2023-05-31";

/** Maximum retry attempts for Bedrock API calls (handled by AWS SDK) */
const MAX_RETRIES = 3;

/** Token budget reserved for system prompt instructions (estimated ~170 tokens, with safety margin) */
const SYSTEM_PROMPT_TOKENS = 200;

/** Maximum number of feedbacks to fetch for initial run (memory limit) */
const MAX_INITIAL_FEEDBACKS = 100;

// ============================================================================
// RUNTIME CONFIGURATION
// ============================================================================

const modelId = process.env.SUMMARY_MODEL_ID || DEFAULT_SUMMARY_MODEL_ID;
const maxContextTokens = parseInt(
  process.env.MAX_CONTEXT_TOKENS || String(DEFAULT_MAX_CONTEXT_TOKENS),
  10
);

let prisma: PrismaClient | null = null;

async function getPrismaClient(): Promise<PrismaClient> {
  if (!prisma) {
    process.env.DATABASE_URL = await getDatabaseUrl();
    prisma = new PrismaClient();
  }
  return prisma;
}

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || "us-west-2",
  maxAttempts: MAX_RETRIES,
});

/**
 * Count tokens using Bedrock CountTokens API
 * @param text - Text content to count tokens for
 * @returns Actual token count from Bedrock
 */
async function countTokens(text: string): Promise<number> {
  try {
    const body = JSON.stringify({
      anthropic_version: ANTHROPIC_VERSION,
      max_tokens: MAX_SUMMARY_OUTPUT_TOKENS,
      messages: [{ role: "user", content: text }],
    });

    const response = await bedrockClient.send(
      new CountTokensCommand({
        modelId: COUNT_TOKENS_MODEL_ID,
        input: {
          invokeModel: {
            body: new TextEncoder().encode(body),
          },
        },
      })
    );
    return response.inputTokens || 0;
  } catch (error) {
    console.warn(
      "Failed to count tokens via API, falling back to estimation:",
      error
    );
    // Fallback to rough estimation if API fails
    return Math.ceil(text.length / 4);
  }
}

interface FeedbackData {
  userComment: string;
  extractedText: string | null;
  explanation: string | null;
  result: string | null;
}

interface ChecklistWithLastUpdate {
  check_id: string;
  last_update: Date | null;
}

export const handler = async (): Promise<{
  processed: number;
  errors: number;
  skipped: number;
}> => {
  console.log("Starting feedback aggregation");

  const db = await getPrismaClient();

  // Find checklists that have NEW feedback since last summary update
  const checklistsWithFeedback = await db.$queryRaw<ChecklistWithLastUpdate[]>`
    SELECT DISTINCT 
      rr.check_id,
      cl.feedback_summary_updated_at as last_update
    FROM review_results rr
    JOIN check_lists cl ON rr.check_id = cl.check_id
    WHERE rr.user_override = true 
      AND rr.user_comment IS NOT NULL
      AND (cl.feedback_summary_updated_at IS NULL 
           OR rr.updated_at > cl.feedback_summary_updated_at)
  `;

  console.log(
    `Found ${checklistsWithFeedback.length} checklists with new feedback`
  );

  let processed = 0;
  let errors = 0;
  let skipped = 0;

  for (const { check_id, last_update } of checklistsWithFeedback) {
    try {
      const wasProcessed = await processChecklist(db, check_id, last_update);
      if (wasProcessed) {
        processed++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`Error processing checklist ${check_id}:`, error);
      errors++;
      // Continue processing next checklist
    }
  }

  console.log(
    `Completed: ${processed} processed, ${skipped} skipped (no new feedback), ${errors} errors`
  );
  return { processed, errors, skipped };
};

async function processChecklist(
  db: PrismaClient,
  checkId: string,
  lastUpdateDate: Date | null
): Promise<boolean> {
  // Fetch checklist info including existing summary
  const checklist = await db.checkList.findUnique({
    where: { id: checkId },
    select: {
      id: true,
      name: true,
      description: true,
      feedbackSummary: true,
    },
  });

  if (!checklist) {
    console.warn(`Checklist ${checkId} not found, skipping`);
    return false;
  }

  // Fetch feedback: all if initial run (null), or new ones since last update
  const feedbacks = await db.reviewResult.findMany({
    where: {
      checkId,
      userOverride: true,
      userComment: { not: null },
      // Only filter by date if lastUpdateDate exists (incremental update)
      ...(lastUpdateDate && { updatedAt: { gt: lastUpdateDate } }),
    },
    select: {
      userComment: true,
      extractedText: true,
      explanation: true,
      result: true,
    },
    orderBy: { updatedAt: "desc" },
    // Limit to 100 for initial run to avoid Lambda memory issues
    take: lastUpdateDate ? undefined : MAX_INITIAL_FEEDBACKS,
  });

  if (feedbacks.length === 0) {
    return false;
  }

  console.log(
    `Processing ${feedbacks.length} ${lastUpdateDate ? "new" : "total"} feedbacks for checklist: ${checklist.name}`
  );

  try {
    // Build context with previous summary + new feedback
    const context = await buildContext(
      checklist.name,
      checklist.description || "",
      checklist.feedbackSummary,
      feedbacks as FeedbackData[]
    );

    // Generate summary
    const summary = await generateSummary(context, !!checklist.feedbackSummary);

    // Update checklist
    await db.checkList.update({
      where: { id: checkId },
      data: {
        feedbackSummary: summary,
        feedbackSummaryUpdatedAt: new Date(),
      },
    });

    console.log(`Updated feedback summary for checklist: ${checklist.name}`);
    return true;
  } catch (error) {
    console.error(`Failed to process checklist ${checkId}:`, error);
    // Propagate error to handler for counting
    throw error;
  }
}

async function buildContext(
  checkName: string,
  checkDescription: string,
  previousSummary: string | null,
  feedbacks: FeedbackData[]
): Promise<string> {
  // Reserve tokens for system prompt
  const maxTokens = maxContextTokens - SYSTEM_PROMPT_TOKENS;
  let currentTokens = 0;

  // Step 1: Checklist info (required, no truncation)
  const checklistContext = `Checklist: ${checkName}\nDescription: ${checkDescription}`;
  const checklistTokens = await countTokens(checklistContext);
  currentTokens += checklistTokens;

  // Step 2: Previous summary (required if exists, no truncation)
  let previousSummaryContext = "";
  let summaryTokens = 0;
  if (previousSummary) {
    previousSummaryContext = `Previous Summary:\n${previousSummary}`;
    summaryTokens = await countTokens(previousSummaryContext);
    currentTokens += summaryTokens;
  }

  // Step 3: Add feedback blocks one by one in complete form
  const feedbackBlocks: string[] = [];
  let includedCount = 0;

  for (const feedback of feedbacks) {
    // Build one feedback block (all elements required, no truncation)
    const parts: string[] = [];

    // userComment (required)
    const aiResult = feedback.result
      ? `AI judged: ${feedback.result}`
      : "AI result: unknown";
    parts.push(`[${aiResult}, User overrode] ${feedback.userComment}`);

    // extractedText (required if exists)
    if (feedback.extractedText) {
      parts.push(`Document excerpt: ${feedback.extractedText}`);
    }

    // explanation (required if exists)
    if (feedback.explanation) {
      parts.push(`AI reasoning: ${feedback.explanation}`);
    }

    const feedbackBlock = parts.join("\n");
    const feedbackTokens = await countTokens(feedbackBlock);

    // Check token budget
    if (currentTokens + feedbackTokens > maxTokens) {
      console.warn(
        `Token budget exceeded: included ${includedCount}/${feedbacks.length} feedbacks ` +
          `(used ${currentTokens}/${maxTokens} tokens, next feedback needs ${feedbackTokens} tokens)`
      );
      break;
    }

    feedbackBlocks.push(feedbackBlock);
    currentTokens += feedbackTokens;
    includedCount++;
  }

  // Error handling: at least one feedback is required
  if (includedCount === 0) {
    const firstFeedbackTokens =
      feedbacks.length > 0
        ? await countTokens(feedbacks[0].userComment || "")
        : 0;
    throw new Error(
      `Cannot fit any feedback within token budget. ` +
        `Checklist: ${checklistTokens} tokens, ` +
        `Previous summary: ${summaryTokens} tokens, ` +
        `First feedback: ${firstFeedbackTokens} tokens (comment only), ` +
        `Available budget: ${maxTokens} tokens`
    );
  }

  // Build final context
  const contextParts = [checklistContext];

  if (previousSummaryContext) {
    contextParts.push(previousSummaryContext);
  }

  contextParts.push(
    `NEW User Feedback (${includedCount} items):\n${feedbackBlocks.join("\n---\n")}`
  );

  const finalContext = contextParts.join("\n\n");

  console.log(
    `Built context: ${includedCount}/${feedbacks.length} feedbacks, ` +
      `${currentTokens} tokens (${Math.round((currentTokens / maxTokens) * 100)}% of budget), ` +
      `system prompt reserved: ${SYSTEM_PROMPT_TOKENS} tokens`
  );

  return finalContext;
}

async function generateSummary(
  context: string,
  hasExistingSummary: boolean
): Promise<string> {
  // Different prompts for initial vs incremental updates
  const prompt = hasExistingSummary
    ? `You are updating a feedback summary for a document review checklist item.

${context}

TASK: Update the summary by incorporating the NEW feedback while preserving valuable insights from the previous summary.

PRIORITY ORDER:
1. NEW feedback patterns take precedence - if they contradict the previous summary, favor the new insights
2. Retain previous insights that are still relevant and not contradicted
3. Remove outdated guidance that new feedback proves incorrect

OUTPUT: A concise 2-4 sentence summary that:
- Emphasizes the most recent correction patterns
- Provides clear, actionable guidance for future reviews
- Is written in the same language as the checklist description`
    : `You are analyzing user feedback for a document review checklist item.

${context}

TASK: Generate a summary of the feedback patterns.

OUTPUT: A concise 2-3 sentence summary that captures:
1. Common patterns in user corrections
2. Specific scenarios where the AI judgment was incorrect
3. Guidance for future reviews to avoid similar mistakes

Respond in the same language as the checklist description.`;

  try {
    const body = JSON.stringify({
      anthropic_version: ANTHROPIC_VERSION,
      max_tokens: MAX_SUMMARY_OUTPUT_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });

    const response = await bedrockClient.send(
      new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: new TextEncoder().encode(body),
      })
    );

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.content[0].text;
  } catch (error: any) {
    // AWS SDK already retried
    console.error(
      `Failed to generate summary after retries: ${error.name} - ${error.message}`
    );
    throw error;
  }
}
