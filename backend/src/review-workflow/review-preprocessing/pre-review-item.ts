import { makePrismaReviewJobRepository } from "../../api/features/review/domain/repository";
import { makePrismaUserPreferenceRepository } from "../../api/features/user-preference/domain/repository";
import { REVIEW_FILE_TYPE } from "../../api/features/review/domain/model/review";
import { makePrismaCheckRepository } from "../../api/features/checklist/domain/repository";
import { makePrismaToolConfigurationRepository } from "../../api/features/tool-configuration/domain/repository";
import { getLanguageName, DEFAULT_LANGUAGE } from "../../utils/language";
declare const console: {
  log: (...data: any[]) => void;
  error: (...data: any[]) => void;
};

export interface PreReviewItemParams {
  reviewJobId: string;
  checkId: string;
  reviewResultId: string;
  userId?: string;
}

/**
 * Pre-process a review item
 * Gathers all necessary data before sending to the Python MCP Lambda
 * @param params Processing parameters
 * @returns Data needed for MCP processing
 */
export async function preReviewItemProcessor(
  params: PreReviewItemParams
): Promise<any> {
  const { reviewJobId, checkId, reviewResultId, userId } = params;

  let userLanguage = DEFAULT_LANGUAGE;

  if (userId) {
    try {
      console.log(`[DEBUG PRE] Getting user preferences for user ${userId}`);
      const userPreferenceRepository =
        await makePrismaUserPreferenceRepository();
      const userPreference =
        await userPreferenceRepository.getUserPreference(userId);

      if (userPreference && userPreference.language) {
        userLanguage = userPreference.language;
        console.log(
          `[DEBUG PRE] Using language from preference: ${userLanguage}`
        );
      }
    } catch (error) {
      console.error(`[DEBUG PRE] Failed to fetch user preferences:`, error);
    }
  }

  const reviewJobRepository = await makePrismaReviewJobRepository();
  const jobDetail = await reviewJobRepository.findReviewJobById({
    reviewJobId,
  });

  const checkRepository = await makePrismaCheckRepository();
  const checkList = await checkRepository.findCheckListItemById(checkId);

  if (!checkList) {
    throw new Error(`Check list item not found: ${checkId}`);
  }

  if (!jobDetail.documents || jobDetail.documents.length === 0) {
    throw new Error(`No documents found for review job ${reviewJobId}`);
  }

  const pdfDocuments = jobDetail.documents.filter(
    (doc) => doc.fileType === REVIEW_FILE_TYPE.PDF
  );

  const imageDocuments = jobDetail.documents.filter(
    (doc) => doc.fileType === REVIEW_FILE_TYPE.IMAGE
  );

  const documentsToProcess = [...pdfDocuments, ...imageDocuments];

  if (documentsToProcess.length === 0) {
    throw new Error(
      `No PDF or image documents found for review job ${reviewJobId}`
    );
  }

  console.log(
    `[DEBUG PRE] Prepared review item data for ${reviewResultId}, found ${pdfDocuments.length} PDF documents and ${imageDocuments.length} image documents`
  );

  // ツール設定を取得
  let toolConfiguration = null;
  if (checkList.toolConfigurationId) {
    const toolConfigRepo = await makePrismaToolConfigurationRepository();
    try {
      const config = await toolConfigRepo.findById(
        checkList.toolConfigurationId
      );
      toolConfiguration = {
        knowledgeBase: config.knowledgeBase,
        codeInterpreter: config.codeInterpreter,
        mcpConfig: config.mcpConfig,
      };
    } catch (error) {
      console.error(`Failed to fetch tool configuration: ${error}`);
    }
  }

  return {
    checkName: checkList.name,
    checkDescription: checkList.description || "",
    feedbackSummary: checkList.feedbackSummary || null,
    languageName: getLanguageName(userLanguage),
    documentPaths: documentsToProcess.map((doc) => doc.s3Path),
    documentIds: documentsToProcess.map((doc) => doc.id),
    toolConfiguration,
  };
}
