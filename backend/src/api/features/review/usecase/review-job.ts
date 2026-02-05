import {
  REVIEW_JOB_STATUS,
  ReviewJobSummary,
  ReviewJobDetail,
} from "../domain/model/review";
import { PaginatedResponse } from "../../../common/types";
import {
  ReviewJobRepository,
  makePrismaReviewJobRepository,
} from "../domain/repository";
import { ulid } from "ulid";
import { getPresignedUrl, getS3ObjectSize } from "../../../core/s3";
import {
  getReviewDocumentKey,
  getReviewImageKey,
} from "../../../../checklist-workflow/common/storage-paths";
import { CreateReviewJobRequest } from "../routes/handlers";
import { createInitialReviewJobModel } from "../domain/service/review-job-factory";
import {
  CheckRepository,
  makePrismaCheckRepository,
} from "../../checklist/domain/repository";
import {
  ApplicationError,
  FileSizeExceededError,
} from "../../../core/errors/application-errors";
import { startStateMachineExecution } from "../../../core/sfn";
import { validateFileSize } from "../../../core/file-validation";
import { MAX_FILE_SIZE } from "../../../constants/index";

import type { RequestUser } from "../../../core/middleware/authorization";
import { assertHasOwnerAccessOrThrow } from "../../../core/middleware/authorization";

export const getAllReviewJobs = async (params: {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: string;
  // オプショナルでリクエストユーザーを受け取り、一般ユーザの場合は ownerUserId を使って絞る
  user?: RequestUser | null;
  deps?: {
    repo?: ReviewJobRepository;
  };
}): Promise<PaginatedResponse<ReviewJobSummary>> => {
  const repo = params.deps?.repo || (await makePrismaReviewJobRepository());

  // 一般ユーザの場合は自身のジョブのみ返す（管理者は全件）
  const ownerUserId =
    params.user && !params.user.isAdmin ? params.user.userId : undefined;

  const result = await repo.findAllReviewJobs({
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    status: params.status,
    ownerUserId,
  });
  return result;
};

export const getReviewDocumentPresignedUrl = async (params: {
  filename: string;
  contentType: string;
}): Promise<{ url: string; key: string; documentId: string }> => {
  const { filename, contentType } = params;
  const bucketName = process.env.DOCUMENT_BUCKET;
  if (!bucketName) {
    throw new Error("S3_BUCKET_NAME is not defined");
  }
  const documentId = ulid();
  const key = getReviewDocumentKey(documentId, filename);
  const url = await getPresignedUrl(bucketName, key, contentType);

  return { url, key, documentId };
};

export const getReviewImagesPresignedUrl = async (params: {
  filenames: string[];
  contentTypes: string[];
}): Promise<{
  files: Array<{
    url: string;
    key: string;
    filename: string;
    documentId: string;
  }>;
}> => {
  const { filenames, contentTypes } = params;
  const bucketName = process.env.DOCUMENT_BUCKET;
  if (!bucketName) {
    throw new Error("S3_BUCKET_NAME is not defined");
  }

  if (filenames.length > 20) {
    throw new ApplicationError("Maximum 20 image files allowed");
  }

  const results = await Promise.all(
    filenames.map(async (filename, index) => {
      const contentType = contentTypes[index];
      const documentId = ulid();
      const key = getReviewImageKey(documentId, filename);
      const url = await getPresignedUrl(bucketName, key, contentType);
      return { url, key, filename, documentId };
    })
  );

  return {
    files: results,
  };
};

export const createReviewJob = async (params: {
  requestBody: CreateReviewJobRequest;
  deps?: {
    checkRepo?: CheckRepository;
    reviewJobRepo?: ReviewJobRepository;
  };
}): Promise<void> => {
  const checkRepo =
    params.deps?.checkRepo || (await makePrismaCheckRepository());
  const reviewJobRepo =
    params.deps?.reviewJobRepo || (await makePrismaReviewJobRepository());

  // バリデーション
  if (
    !params.requestBody.documents ||
    params.requestBody.documents.length === 0
  ) {
    throw new ApplicationError("At least one document is required");
  }

  if (params.requestBody.documents.length > 20) {
    throw new ApplicationError("Maximum 20 documents allowed");
  }

  // Validate file sizes from S3
  const bucketName = process.env.DOCUMENT_BUCKET;
  if (!bucketName) {
    throw new ApplicationError("DOCUMENT_BUCKET is not defined");
  }

  for (const doc of params.requestBody.documents) {
    try {
      const fileSize = await getS3ObjectSize(bucketName, doc.s3Key);
      if (!validateFileSize(fileSize, MAX_FILE_SIZE)) {
        throw new FileSizeExceededError(doc.filename, fileSize, MAX_FILE_SIZE);
      }
    } catch (error) {
      if (error instanceof FileSizeExceededError) {
        throw error;
      }
      // If file doesn't exist or other S3 error, let it proceed (will fail later in processing)
      console.warn(`Could not validate file size for ${doc.s3Key}:`, error);
    }
  }

  const reviewJob = await createInitialReviewJobModel({
    req: params.requestBody,
    deps: {
      checkRepo,
    },
  });

  await reviewJobRepo.createReviewJob(reviewJob);

  const stateMachineArn = process.env.REVIEW_PROCESSING_STATE_MACHINE_ARN;
  if (!stateMachineArn) {
    throw new ApplicationError(
      "REVIEW_PROCESSING_STATE_MACHINE_ARN is not defined"
    );
  }

  // Invoke the state machine with file type information and userId for language preferences
  await startStateMachineExecution(stateMachineArn, {
    reviewJobId: reviewJob.id,
    userId: params.requestBody.userId,
  });
};

export const removeReviewJob = async (params: {
  reviewJobId: string;
  user?: RequestUser | null;
  deps?: {
    repo?: ReviewJobRepository;
  };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaReviewJobRepository());

  // 取得して所有者チェックを行う
  const job = await repo.findReviewJobById({ reviewJobId: params.reviewJobId });
  assertHasOwnerAccessOrThrow(params.user || null, job.userId, {
    api: "removeReviewJob",
    resourceId: params.reviewJobId,
    logger: console,
  });

  await repo.deleteReviewJobById({
    reviewJobId: params.reviewJobId,
  });
};

export const modifyJobStatus = async (params: {
  reviewJobId: string;
  status: REVIEW_JOB_STATUS;
  deps?: {
    repo?: ReviewJobRepository;
  };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaReviewJobRepository());
  await repo.updateJobStatus({
    reviewJobId: params.reviewJobId,
    status: params.status,
  });
};
export const getReviewJobById = async (params: {
  reviewJobId: string;
  user?: RequestUser | null;
  deps?: {
    repo?: ReviewJobRepository;
  };
}): Promise<ReviewJobDetail> => {
  const repo = params.deps?.repo || (await makePrismaReviewJobRepository());
  const job = await repo.findReviewJobById({
    reviewJobId: params.reviewJobId,
  });

  // 所有者チェック（一般ユーザは自分のジョブのみ参照可能）
  assertHasOwnerAccessOrThrow(params.user || null, job.userId, {
    api: "getReviewJobById",
    resourceId: params.reviewJobId,
    logger: console,
  });

  return job;
};
