import {
  REVIEW_RESULT,
  ReviewResultDetail,
  ReviewResultDomain,
} from "../domain/model/review";
import {
  ReviewResultRepository,
  makePrismaReviewResultRepository,
  ReviewJobRepository,
  makePrismaReviewJobRepository,
} from "../domain/repository";
import { updateCheckResultCascade } from "../domain/service/review-result-cascade-update";
import {
  assertHasOwnerAccessOrThrow,
  RequestUser,
} from "../../../core/middleware/authorization";

export const getReviewResults = async (params: {
  reviewJobId: string;
  parentId?: string;
  filter?: REVIEW_RESULT;
  includeAllChildren?: boolean;
  user?: RequestUser;
  deps?: {
    repo?: ReviewResultRepository;
    reviewJobRepo?: ReviewJobRepository;
  };
}): Promise<ReviewResultDetail[]> => {
  const repo = params.deps?.repo || (await makePrismaReviewResultRepository());
  const reviewJobRepo =
    params.deps?.reviewJobRepo || (await makePrismaReviewJobRepository());

  // 所有者チェックを行う（管理者はパス）
  const job = await reviewJobRepo.findReviewJobById({
    reviewJobId: params.reviewJobId,
  });
  assertHasOwnerAccessOrThrow(params.user, job.userId, {
    api: "getReviewResults",
    resourceId: job.id,
    logger: console,
  });

  const reviewResults = await repo.findReviewResultsById({
    jobId: params.reviewJobId,
    parentId: params.parentId,
    filter: params.filter,
    includeAllChildren: params.includeAllChildren || false,
  });
  return reviewResults;
};

export const overrideReviewResult = async (params: {
  reviewJobId: string;
  resultId: string;
  result: REVIEW_RESULT;
  userComment: string;
  user?: RequestUser;
  deps?: {
    repo?: ReviewResultRepository;
    reviewJobRepo?: ReviewJobRepository;
  };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaReviewResultRepository());

  const current = await repo.findDetailedReviewResultById({
    resultId: params.resultId,
  });

  // ジョブ所有者の検証
  const reviewJobRepo =
    params.deps?.reviewJobRepo || (await makePrismaReviewJobRepository());
  const job = await reviewJobRepo.findReviewJobById({
    reviewJobId: current.reviewJobId,
  });
  assertHasOwnerAccessOrThrow(params.user, job.userId, {
    api: "overrideReviewResult",
    resourceId: job.id,
    logger: console,
  });

  const updated = ReviewResultDomain.fromOverrideRequest({
    current,
    result: params.result,
    userComment: params.userComment,
  });

  await updateCheckResultCascade({
    updated,
    deps: {
      reviewResultRepo: repo,
    },
  });
};
