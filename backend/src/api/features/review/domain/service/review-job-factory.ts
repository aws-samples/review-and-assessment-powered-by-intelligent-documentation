import { ulid } from "ulid";
import { NotFoundError } from "../../../../core/errors";
import { CheckRepository } from "../../../checklist/domain/repository";
import { CreateReviewJobRequest } from "../../routes/handlers";
import {
  REVIEW_RESULT_STATUS,
  REVIEW_JOB_STATUS,
  ReviewJobEntity,
  ReviewResultEntity,
} from "../model/review";

export const createInitialReviewJobModel = async (params: {
  req: CreateReviewJobRequest;
  deps: {
    checkRepo: CheckRepository;
  };
}): Promise<ReviewJobEntity> => {
  const { req, deps } = params;
  const { checkRepo } = deps;

  const checkListSet = await checkRepo.findCheckListItems(
    req.checkListSetId,
    undefined,
    true // Fetch all checklists
  );

  if (checkListSet.length === 0) {
    throw new NotFoundError(`ChecklistSet not found`, req.checkListSetId);
  }

  console.log(
    `[createInitialReviewJobModel] checkListSet has ${checkListSet.length} items`
  );

  const jobId = ulid();
  const initialResults = checkListSet.map((checkList) => {
    return createInitialReviewResult(jobId, checkList.id);
  });

  console.log(
    `[createInitialReviewJobModel] initialResults has ${initialResults.length} items`
  );

  return {
    id: jobId,
    name: req.name,
    status: REVIEW_JOB_STATUS.PENDING,
    checkListSetId: req.checkListSetId,
    userId: req.userId,
    documents: req.documents,
    results: initialResults,
  };
};

const createInitialReviewResult = (
  reviewJobId: string,
  checkId: string
): ReviewResultEntity => {
  return {
    id: ulid(),
    reviewJobId,
    checkId,
    status: REVIEW_RESULT_STATUS.PENDING,
    userOverride: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};
