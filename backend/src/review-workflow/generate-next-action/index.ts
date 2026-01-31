/**
 * Next Action Generator Lambda Handler
 *
 * This module generates actionable next steps based on review results.
 * It uses template variables to embed review data into the prompt template.
 *
 * TEMPLATE VARIABLES:
 * - {{failed_items}} - Failed items with details (rule name, AI judgment, explanation)
 * - {{user_overrides}} - Items that users overrode with their comments
 * - {{all_results}} - All review results
 * - {{document_info}} - Review document information
 * - {{checklist_name}} - Checklist name
 * - {{pass_count}} - Number of passed items
 * - {{fail_count}} - Number of failed items
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { getPrismaClient } from "../../api/core/db";
import { NEXT_ACTION_STATUS } from "../../api/features/review/domain/model/review";

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/** Default AI model for generating next actions (cross-region inference) */
const DEFAULT_MODEL_ID = "global.anthropic.claude-sonnet-4-20250514-v1:0";

/** Maximum tokens for AI output */
const MAX_OUTPUT_TOKENS = 4096;

/** Anthropic API version for Bedrock */
const ANTHROPIC_VERSION = "bedrock-2023-05-31";

/** Maximum retry attempts for Bedrock API calls */
const MAX_RETRIES = 3;

/** Default prompt for Next Action generation */
const DEFAULT_NEXT_ACTION_PROMPT = `
You are an AI assistant that generates actionable next steps based on document review results.

## Review Target Documents
{{document_info}}

## Checklist: {{checklist_name}}

## Review Results Summary
- Passed: {{pass_count}} items
- Failed: {{fail_count}} items

## Failed Item Details
{{failed_items}}

## User Judgment Overrides
{{user_overrides}}

## Output Format
Generate a markdown-formatted response with the following structure:

### Overall Assessment
Brief summary of the review outcome based on the results above.

### Required Corrections
For each failed item:
1. **Target File/Section**: Which part of the document needs modification
2. **Correction Content**: Specific details of what to add or modify
3. **Priority**: High/Medium/Low
4. **Reference**: Extracted text or explanation that supports this action

### Recommended Actions
Prioritized list of correction tasks:
- High Priority: Items that failed review and require immediate attention
- Medium Priority: Items with user overrides that may need review
- Low Priority: Recommendations for improvement

## Guidelines
- Be specific about WHICH file or section needs modification
- Provide concrete examples of WHAT content should be added
- Reference the extracted text and explanations from failed items
- Output in the same language as the input document
`;

// ============================================================================
// RUNTIME CONFIGURATION
// ============================================================================

const modelId = process.env.NEXT_ACTION_MODEL_ID || DEFAULT_MODEL_ID;

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || "us-west-2",
  maxAttempts: MAX_RETRIES,
});

// ============================================================================
// TYPES
// ============================================================================

interface ReviewResultWithCheckList {
  id: string;
  result: string | null;
  confidenceScore: number | null;
  explanation: string | null;
  shortExplanation: string | null;
  extractedText: string | null;
  userOverride: boolean;
  userComment: string | null;
  checkList: {
    id: string;
    name: string;
    description: string | null;
  };
}

interface DocumentInfo {
  id: string;
  filename: string;
}

// ============================================================================
// TEMPLATE VARIABLE EXPANSION
// ============================================================================

/**
 * Expand template variables in the prompt
 */
function expandTemplateVariables(
  template: string,
  data: {
    failedItems: ReviewResultWithCheckList[];
    userOverrides: ReviewResultWithCheckList[];
    allResults: ReviewResultWithCheckList[];
    documents: DocumentInfo[];
    checklistName: string;
    passCount: number;
    failCount: number;
  }
): string {
  let result = template;

  // {{failed_items}}
  result = result.replace(
    /\{\{failed_items\}\}/g,
    formatFailedItems(data.failedItems)
  );

  // {{user_overrides}}
  result = result.replace(
    /\{\{user_overrides\}\}/g,
    formatUserOverrides(data.userOverrides)
  );

  // {{all_results}}
  result = result.replace(
    /\{\{all_results\}\}/g,
    formatAllResults(data.allResults)
  );

  // {{document_info}}
  result = result.replace(
    /\{\{document_info\}\}/g,
    formatDocumentInfo(data.documents)
  );

  // {{checklist_name}}
  result = result.replace(/\{\{checklist_name\}\}/g, data.checklistName);

  // {{pass_count}}
  result = result.replace(/\{\{pass_count\}\}/g, String(data.passCount));

  // {{fail_count}}
  result = result.replace(/\{\{fail_count\}\}/g, String(data.failCount));

  return result;
}

function formatFailedItems(items: ReviewResultWithCheckList[]): string {
  if (items.length === 0) {
    return "No failed items.";
  }

  return items
    .map((item) => {
      const parts = [`- **${item.checkList.name}**: Failed`];

      if (item.confidenceScore !== null) {
        parts[0] += ` (Confidence: ${(item.confidenceScore * 100).toFixed(0)}%)`;
      }

      if (item.checkList.description) {
        parts.push(`  Rule: ${item.checkList.description}`);
      }

      if (item.explanation) {
        parts.push(`  Explanation: ${item.explanation}`);
      }

      if (item.extractedText) {
        const extracted = parseExtractedText(item.extractedText);
        if (extracted.length > 0) {
          parts.push(
            `  Extracted text: "${extracted.slice(0, 3).join('", "')}"`
          );
        }
      }

      return parts.join("\n");
    })
    .join("\n\n");
}

function formatUserOverrides(items: ReviewResultWithCheckList[]): string {
  if (items.length === 0) {
    return "No user overrides.";
  }

  return items
    .map((item) => {
      const aiResult =
        item.result === "pass"
          ? "Pass"
          : item.result === "fail"
            ? "Fail"
            : "Unknown";
      const overriddenTo = item.result === "pass" ? "Fail" : "Pass"; // User overrode to opposite

      const parts = [
        `- **${item.checkList.name}**: AI judged ${aiResult} -> User changed to ${overriddenTo}`,
      ];

      if (item.userComment) {
        parts.push(`  Comment: ${item.userComment}`);
      }

      return parts.join("\n");
    })
    .join("\n\n");
}

function formatAllResults(items: ReviewResultWithCheckList[]): string {
  if (items.length === 0) {
    return "No results available.";
  }

  return items
    .map((item) => {
      const result =
        item.result === "pass"
          ? "Pass"
          : item.result === "fail"
            ? "Fail"
            : "Pending";
      const override = item.userOverride ? " (User Override)" : "";

      return `- **${item.checkList.name}**: ${result}${override}`;
    })
    .join("\n");
}

function formatDocumentInfo(documents: DocumentInfo[]): string {
  if (documents.length === 0) {
    return "No documents.";
  }

  return documents.map((doc) => `- ${doc.filename}`).join("\n");
}

function parseExtractedText(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Not JSON, treat as plain text
    if (value.trim()) return [value.trim()];
  }
  return [];
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export interface GenerateNextActionEvent {
  reviewJobId: string;
}

export interface GenerateNextActionResult {
  success: boolean;
  status: NEXT_ACTION_STATUS;
  message?: string;
}

export async function generateNextAction(
  event: GenerateNextActionEvent
): Promise<GenerateNextActionResult> {
  const { reviewJobId } = event;
  console.log(`[GenerateNextAction] Starting for reviewJobId: ${reviewJobId}`);

  const db = await getPrismaClient();

  try {
    // 1. Get ReviewJob with CheckListSet
    const reviewJob = await db.reviewJob.findUnique({
      where: { id: reviewJobId },
      include: {
        checkListSet: true,
        documents: {
          select: {
            id: true,
            filename: true,
          },
        },
      },
    });

    if (!reviewJob) {
      console.error(`[GenerateNextAction] ReviewJob not found: ${reviewJobId}`);
      return {
        success: false,
        status: NEXT_ACTION_STATUS.FAILED,
        message: "Review job not found",
      };
    }

    // 2. Check if Next Action is enabled
    const enableNextAction = reviewJob.checkListSet.enableNextAction;
    const nextActionTemplateId = reviewJob.checkListSet.nextActionTemplateId;

    if (!enableNextAction) {
      console.log(`[GenerateNextAction] Next Action is disabled, skipping`);

      // Update status to skipped
      await db.reviewJob.update({
        where: { id: reviewJobId },
        data: {
          nextActionStatus: NEXT_ACTION_STATUS.SKIPPED,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        status: NEXT_ACTION_STATUS.SKIPPED,
        message: "Next Action is disabled",
      };
    }

    // 3. Set status to processing
    await db.reviewJob.update({
      where: { id: reviewJobId },
      data: {
        nextActionStatus: NEXT_ACTION_STATUS.PROCESSING,
        updatedAt: new Date(),
      },
    });

    // 4. Get prompt template (use default if not specified)
    let promptToUse: string;

    if (nextActionTemplateId) {
      const template = await db.promptTemplate.findUnique({
        where: { id: nextActionTemplateId },
      });

      if (!template) {
        console.error(
          `[GenerateNextAction] Template not found: ${nextActionTemplateId}`
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
          message: "Prompt template not found",
        };
      }

      promptToUse = template.prompt;
      console.log(
        `[GenerateNextAction] Using custom template: ${nextActionTemplateId}`
      );
    } else {
      promptToUse = DEFAULT_NEXT_ACTION_PROMPT;
      console.log(`[GenerateNextAction] Using default prompt`);
    }

    // 5. Get review results
    const reviewResults = await db.reviewResult.findMany({
      where: { reviewJobId },
      include: {
        checkList: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    // 6. Prepare template variable data
    const failedItems = reviewResults.filter(
      (r) => r.result === "fail" && !r.userOverride
    );
    const userOverrides = reviewResults.filter((r) => r.userOverride);
    const passCount = reviewResults.filter((r) => r.result === "pass").length;
    const failCount = reviewResults.filter((r) => r.result === "fail").length;

    // 7. Expand template variables
    const expandedPrompt = expandTemplateVariables(promptToUse, {
      failedItems: failedItems as ReviewResultWithCheckList[],
      userOverrides: userOverrides as ReviewResultWithCheckList[],
      allResults: reviewResults as ReviewResultWithCheckList[],
      documents: reviewJob.documents,
      checklistName: reviewJob.checkListSet.name,
      passCount,
      failCount,
    });

    console.log(
      `[GenerateNextAction] Expanded prompt length: ${expandedPrompt.length}`
    );

    // 8. Call Bedrock to generate next action
    const nextAction = await callBedrock(expandedPrompt);

    // 9. Save result
    await db.reviewJob.update({
      where: { id: reviewJobId },
      data: {
        nextAction,
        nextActionStatus: NEXT_ACTION_STATUS.COMPLETED,
        updatedAt: new Date(),
      },
    });

    console.log(`[GenerateNextAction] Completed successfully`);

    return {
      success: true,
      status: NEXT_ACTION_STATUS.COMPLETED,
    };
  } catch (error) {
    console.error(`[GenerateNextAction] Error:`, error);

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

async function callBedrock(prompt: string): Promise<string> {
  const body = JSON.stringify({
    anthropic_version: ANTHROPIC_VERSION,
    max_tokens: MAX_OUTPUT_TOKENS,
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
}
