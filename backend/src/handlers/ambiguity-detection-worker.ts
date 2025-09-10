import { SQSEvent, SQSHandler } from "aws-lambda";
import { detectChecklistAmbiguity } from "../api/features/checklist/usecase/ambiguity-detection";
import { makePrismaCheckRepository } from "../api/features/checklist/domain/repository";
import { CHECK_LIST_STATUS } from "../api/features/checklist/domain/model/checklist";

/**
 * Lambda handler for processing ambiguity detection tasks from SQS
 */
export const handler: SQSHandler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const { checkListSetId, userId } = JSON.parse(record.body);
    const repo = await makePrismaCheckRepository();
    
    try {
      console.log(`Starting ambiguity detection for checkListSetId: ${checkListSetId}`);
      
      // Execute ambiguity detection process
      await detectChecklistAmbiguity({
        checkListSetId,
        userId,
      });
      
      // Update document status to completed on success
      const checkListSet = await repo.findCheckListSetDetailById(checkListSetId);
      if (checkListSet.documents.length > 0) {
        await repo.updateDocumentStatus({
          documentId: checkListSet.documents[0].id,
          status: CHECK_LIST_STATUS.COMPLETED,
        });
      }
      
      console.log(`Completed ambiguity detection for checkListSetId: ${checkListSetId}`);
    } catch (error) {
      console.error("Ambiguity detection failed:", error);
      
      // Update document status to failed on error
      const checkListSet = await repo.findCheckListSetDetailById(checkListSetId);
      if (checkListSet.documents.length > 0) {
        await repo.updateDocumentStatus({
          documentId: checkListSet.documents[0].id,
          status: CHECK_LIST_STATUS.FAILED,
          errorDetail: error instanceof Error ? error.message : String(error),
        });
      }
      
      throw error; // Let SQS handle retry logic and DLQ
    }
  }
};
