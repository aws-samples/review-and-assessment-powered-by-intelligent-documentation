/**
 * Pre-Generate Next Action Handler
 *
 * Prepares data for the Strands Agent that generates next actions.
 * This step:
 * - Checks if Next Action generation is enabled
 * - Retrieves the prompt template (or uses default)
 * - Retrieves the tool configuration if specified
 * - Gathers review results and formats template data
 */

import { getPrismaClient } from "../../api/core/db";
import { NEXT_ACTION_STATUS } from "../../api/features/review/domain/model/review";
import { makePrismaToolConfigurationRepository } from "../../api/features/tool-configuration/domain/repository";

declare const console: {
  log: (...data: any[]) => void;
  error: (...data: any[]) => void;
};

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

export interface PreGenerateNextActionParams {
  reviewJobId: string;
  userId?: string;
}

interface TemplateData {
  checklistName: string;
  passCount: number;
  failCount: number;
  failedItems: FailedItem[];
  userOverrides: UserOverride[];
  allResults: ReviewResult[];
  documents: DocumentInfo[];
}

interface FailedItem {
  checkList: {
    name: string;
    description?: string | null;
  };
  result: string | null;
  explanation?: string | null;
  extractedText?: string | null;
  confidenceScore?: number | null;
}

interface UserOverride {
  checkList: {
    name: string;
  };
  result: string | null;
  userComment?: string | null;
}

interface ReviewResult {
  checkList: {
    name: string;
  };
  result: string | null;
  userOverride?: boolean;
}

interface DocumentInfo {
  filename: string;
}

interface ToolConfigurationOutput {
  id: string;
  name: string;
  knowledgeBases?: KnowledgeBaseConfig[];
  enableCodeInterpreter?: boolean;
  mcpServers?: McpServerConfig[];
}

interface KnowledgeBaseConfig {
  knowledgeBaseId: string;
  description?: string;
}

interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface PreGenerateNextActionResult {
  shouldGenerate: boolean;
  promptTemplate?: {
    prompt: string;
    toolConfigurationId?: string;
  };
  templateData?: TemplateData;
  toolConfiguration?: ToolConfigurationOutput;
  message?: string;
}

export async function preGenerateNextAction(
  params: PreGenerateNextActionParams
): Promise<PreGenerateNextActionResult> {
  const { reviewJobId } = params;
  console.log(
    `[PreGenerateNextAction] Starting for reviewJobId: ${reviewJobId}`
  );

  const db = await getPrismaClient();

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
    console.error(
      `[PreGenerateNextAction] ReviewJob not found: ${reviewJobId}`
    );
    return {
      shouldGenerate: false,
      message: "Review job not found",
    };
  }

  // 2. Check if Next Action is enabled
  const enableNextAction = reviewJob.checkListSet.enableNextAction;
  const nextActionTemplateId = reviewJob.checkListSet.nextActionTemplateId;

  if (!enableNextAction) {
    console.log(`[PreGenerateNextAction] Next Action is disabled, skipping`);

    // Update status to skipped
    await db.reviewJob.update({
      where: { id: reviewJobId },
      data: {
        nextActionStatus: NEXT_ACTION_STATUS.SKIPPED,
        updatedAt: new Date(),
      },
    });

    return {
      shouldGenerate: false,
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
  let promptToUse: string = DEFAULT_NEXT_ACTION_PROMPT;
  let toolConfigurationId: string | undefined;

  if (nextActionTemplateId) {
    const template = await db.promptTemplate.findUnique({
      where: { id: nextActionTemplateId },
    });

    if (!template) {
      console.error(
        `[PreGenerateNextAction] Template not found: ${nextActionTemplateId}`
      );

      await db.reviewJob.update({
        where: { id: reviewJobId },
        data: {
          nextActionStatus: NEXT_ACTION_STATUS.FAILED,
          updatedAt: new Date(),
        },
      });

      return {
        shouldGenerate: false,
        message: "Prompt template not found",
      };
    }

    promptToUse = template.prompt;
    toolConfigurationId = template.toolConfigurationId ?? undefined;
    console.log(
      `[PreGenerateNextAction] Using custom template: ${nextActionTemplateId}`
    );
  } else {
    console.log(`[PreGenerateNextAction] Using default prompt`);
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

  const templateData: TemplateData = {
    checklistName: reviewJob.checkListSet.name,
    passCount,
    failCount,
    failedItems: failedItems.map((item) => ({
      checkList: {
        name: item.checkList.name,
        description: item.checkList.description,
      },
      result: item.result,
      explanation: item.explanation,
      extractedText: item.extractedText,
      confidenceScore: item.confidenceScore,
    })),
    userOverrides: userOverrides.map((item) => ({
      checkList: { name: item.checkList.name },
      result: item.result,
      userComment: item.userComment,
    })),
    allResults: reviewResults.map((item) => ({
      checkList: { name: item.checkList.name },
      result: item.result,
      userOverride: item.userOverride,
    })),
    documents: reviewJob.documents.map((doc) => ({
      filename: doc.filename,
    })),
  };

  // 7. Get tool configuration if specified
  let toolConfiguration: ToolConfigurationOutput | undefined;
  if (toolConfigurationId) {
    const toolConfigRepo = await makePrismaToolConfigurationRepository();
    try {
      const config = await toolConfigRepo.findById(toolConfigurationId);

      // Transform to agent-compatible format
      toolConfiguration = {
        id: config.id,
        name: config.name,
      };

      // Add knowledge bases if configured
      if (config.knowledgeBase?.length) {
        toolConfiguration.knowledgeBases = config.knowledgeBase;
      }

      // Add code interpreter if enabled
      if (config.codeInterpreter) {
        toolConfiguration.enableCodeInterpreter = true;
      }

      // Add MCP servers if configured
      if (config.mcpConfig?.mcpServers?.length) {
        toolConfiguration.mcpServers = config.mcpConfig.mcpServers;
      }

      console.log(
        `[PreGenerateNextAction] Using tool configuration: ${toolConfigurationId}`
      );
    } catch (error) {
      console.error(
        `[PreGenerateNextAction] Failed to fetch tool configuration: ${error}`
      );
      // Continue without tool configuration
    }
  }

  console.log(
    `[PreGenerateNextAction] Prepared data: ${passCount} pass, ${failCount} fail, ${failedItems.length} failed items`
  );

  return {
    shouldGenerate: true,
    promptTemplate: {
      prompt: promptToUse,
      toolConfigurationId,
    },
    templateData,
    toolConfiguration,
  };
}
