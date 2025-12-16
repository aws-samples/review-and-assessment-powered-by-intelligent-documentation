import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { PrismaClient } from "../../prisma/client";
import { getDatabaseUrl } from "../utils/database";

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
});

const DEFAULT_LOOKBACK_DAYS = parseInt(
  process.env.FEEDBACK_AGGREGATION_DAYS || "7",
  10
);
const MODEL_ID =
  process.env.SUMMARY_MODEL_ID || "global.anthropic.claude-sonnet-4-20250514-v1:0";
const MAX_CONTEXT_TOKENS = parseInt(
  process.env.MAX_CONTEXT_TOKENS || "8000",
  10
);

// Rough token estimation (4 chars per token for mixed content)
const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

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

export const handler = async (): Promise<{ processed: number; errors: number; skipped: number }> => {
  console.log("Starting feedback aggregation");

  const db = await getPrismaClient();

  // Default fallback cutoff for checklists without previous summary
  const defaultCutoff = new Date();
  defaultCutoff.setDate(defaultCutoff.getDate() - DEFAULT_LOOKBACK_DAYS);

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

  console.log(`Found ${checklistsWithFeedback.length} checklists with new feedback`);

  let processed = 0;
  let errors = 0;
  let skipped = 0;

  for (const { check_id, last_update } of checklistsWithFeedback) {
    try {
      // Use last summary update time, or fall back to default lookback
      const cutoffDate = last_update || defaultCutoff;
      
      const wasProcessed = await processChecklist(db, check_id, cutoffDate);
      if (wasProcessed) {
        processed++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`Error processing checklist ${check_id}:`, error);
      errors++;
    }
  }

  console.log(`Completed: ${processed} processed, ${skipped} skipped (no new feedback), ${errors} errors`);
  return { processed, errors, skipped };
};

async function processChecklist(
  db: PrismaClient,
  checkId: string,
  cutoffDate: Date
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

  // Fetch NEW feedback since last update, ordered by most recent first
  const feedbacks = await db.reviewResult.findMany({
    where: {
      checkId,
      userOverride: true,
      userComment: { not: null },
      updatedAt: { gt: cutoffDate },
    },
    select: {
      userComment: true,
      extractedText: true,
      explanation: true,
      result: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (feedbacks.length === 0) {
    return false;
  }

  console.log(
    `Processing ${feedbacks.length} new feedbacks for checklist: ${checklist.name}`
  );

  // Build context with previous summary + new feedback
  const context = buildContext(
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
}

function buildContext(
  checkName: string,
  checkDescription: string,
  previousSummary: string | null,
  feedbacks: FeedbackData[]
): string {
  const parts: string[] = [];
  let currentTokens = 0;
  const maxTokens = MAX_CONTEXT_TOKENS;

  // Priority 1: Checklist info (always include)
  const checklistContext = `Checklist: ${checkName}\nDescription: ${checkDescription}`;
  parts.push(checklistContext);
  currentTokens += estimateTokens(checklistContext);

  // Priority 2: New user feedback (highest priority - 50% budget)
  const newFeedbackBudget = maxTokens * 0.5;
  const feedbackItems: string[] = [];
  let includedCount = 0;
  
  for (const f of feedbacks) {
    const aiResult = f.result ? `AI judged: ${f.result}` : "AI result: unknown";
    const item = `[${aiResult}, User overrode] ${f.userComment}`;
    const itemTokens = estimateTokens(item);
    
    if (currentTokens + itemTokens < newFeedbackBudget) {
      feedbackItems.push(item);
      currentTokens += itemTokens;
      includedCount++;
    } else {
      break;
    }
  }
  
  if (includedCount < feedbacks.length) {
    console.warn(`Token limit: included ${includedCount}/${feedbacks.length} new feedbacks`);
  }
  
  const newFeedbackContext = `NEW User Feedback (${includedCount} items):\n${feedbackItems.join("\n---\n")}`;
  parts.push(newFeedbackContext);

  // Priority 3: Previous summary (if exists - 15% budget)
  if (previousSummary) {
    const summaryBudget = maxTokens * 0.65; // 50% + 15%
    const prevSummaryContext = `Previous Summary:\n${previousSummary}`;
    const summaryTokens = estimateTokens(prevSummaryContext);
    
    if (currentTokens + summaryTokens < summaryBudget) {
      parts.push(prevSummaryContext);
      currentTokens += summaryTokens;
    } else {
      // Truncate previous summary if too long
      const availableChars = (summaryBudget - currentTokens) * 4;
      if (availableChars > 100) {
        parts.push(`Previous Summary:\n${previousSummary.substring(0, availableChars)}...`);
        currentTokens = summaryBudget;
      }
    }
  }

  // Priority 4: extracted_text from new feedback (up to 80%)
  for (const feedback of feedbacks.slice(0, includedCount)) {
    if (feedback.extractedText && currentTokens < maxTokens * 0.8) {
      const text = `Document excerpt: ${feedback.extractedText.substring(0, 500)}`;
      const tokens = estimateTokens(text);
      if (currentTokens + tokens < maxTokens * 0.8) {
        parts.push(text);
        currentTokens += tokens;
      } else {
        break;
      }
    }
  }

  // Priority 5: explanation from new feedback (up to 90%)
  for (const feedback of feedbacks.slice(0, includedCount)) {
    if (feedback.explanation && currentTokens < maxTokens * 0.9) {
      const exp = `AI reasoning: ${feedback.explanation.substring(0, 300)}`;
      const tokens = estimateTokens(exp);
      if (currentTokens + tokens < maxTokens * 0.9) {
        parts.push(exp);
        currentTokens += tokens;
      } else {
        break;
      }
    }
  }

  console.log(`Built context with ~${currentTokens} estimated tokens`);
  return parts.join("\n\n");
}

// Retryable error types from official Bedrock documentation
function isRetryableError(error: any): boolean {
  const retryableNames = [
    "ThrottlingException",
    "ServiceUnavailableException",
    "ModelNotReadyException",
    "InternalServerException",
  ];
  
  const retryableStatusCodes = [429, 500, 503];
  
  return (
    retryableNames.includes(error.name) ||
    retryableStatusCodes.includes(error.$metadata?.httpStatusCode)
  );
}

async function generateSummary(
  context: string,
  hasExistingSummary: boolean,
  retryCount = 0
): Promise<string> {
  const MAX_RETRIES = 3;
  
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
    const response = await bedrockClient.send(
      new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        }),
      })
    );

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.content[0].text;
  } catch (error: any) {
    // Handle context too large - reduce and retry
    if (error.name === "ValidationException" && context.length > 4000) {
      console.warn("Context too large, retrying with reduced context");
      const reducedContext = context.substring(0, Math.floor(context.length * 0.6));
      return generateSummary(reducedContext, hasExistingSummary, retryCount);
    }

    // Exponential backoff for retryable errors
    if (isRetryableError(error) && retryCount < MAX_RETRIES) {
      const baseDelay = Math.min(Math.pow(2, retryCount) * 1000, 60000);
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;
      
      console.warn(
        `${error.name || "Error"} (HTTP ${error.$metadata?.httpStatusCode}), ` +
        `retrying in ${Math.round(delay)}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return generateSummary(context, hasExistingSummary, retryCount + 1);
    }

    console.error(`Failed to generate summary: ${error.name} - ${error.message}`);
    throw error;
  }
}
