import { FastifyReply, FastifyRequest } from "fastify";
import {
  createReviewJob,
  getAllReviewJobs,
  getReviewJobById,
  getReviewDocumentPresignedUrl,
  getReviewImagesPresignedUrl,
  removeReviewJob,
} from "../usecase/review-job";
import { deleteS3Object } from "../../../core/s3";
import { REVIEW_FILE_TYPE, REVIEW_RESULT } from "../domain/model/review";
import {
  overrideReviewResult,
  getReviewResults,
} from "../usecase/review-result";
import { getDocumentDownloadUrl } from "../usecase/document";

export const getAllReviewJobsHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const jobs = await getAllReviewJobs({});
  reply.code(200).send({
    success: true,
    data: jobs,
  });
};

interface GetPresignedUrlRequest {
  filename: string;
  contentType: string;
}

export const getReviewPresignedUrlHandler = async (
  request: FastifyRequest<{ Body: GetPresignedUrlRequest }>,
  reply: FastifyReply
): Promise<void> => {
  const { filename, contentType } = request.body;

  const result = await getReviewDocumentPresignedUrl({
    filename,
    contentType,
  });

  reply.code(200).send({
    success: true,
    data: result,
  });
};

export const getReviewImagesPresignedUrlHandler = async (
  request: FastifyRequest<{ Body: { filenames: string[], contentTypes: string[] } }>,
  reply: FastifyReply
): Promise<void> => {
  const { filenames, contentTypes } = request.body;

  if (filenames.length > 20) {
    reply.code(400).send({
      success: false,
      error: "Maximum 20 image files allowed",
    });
    return;
  }

  const result = await getReviewImagesPresignedUrl({
    filenames,
    contentTypes,
  });

  reply.code(200).send({
    success: true,
    data: result,
  });
};

export const deleteReviewDocumentHandler = async (
  request: FastifyRequest<{ Params: { key: string } }>,
  reply: FastifyReply
): Promise<void> => {
  const { key } = request.params;
  const bucketName = process.env.DOCUMENT_BUCKET;
  if (!bucketName) {
    throw new Error("Bucket name is not defined");
  }
  await deleteS3Object(bucketName, key);

  reply.code(200).send({
    success: true,
    data: {
      deleted: true,
    },
  });
};

export interface CreateReviewJobRequest {
  name: string;
  checkListSetId: string;
  documents: Array<{
    id: string;
    filename: string;
    s3Key: string;
    fileType: REVIEW_FILE_TYPE;
  }>;
  userId?: string;
}

export const createReviewJobHandler = async (
  request: FastifyRequest<{ Body: CreateReviewJobRequest }>,
  reply: FastifyReply
): Promise<void> => {
  await createReviewJob({
    requestBody: request.body,
  });
  reply.code(201).send({
    success: true,
    data: {},
  });
};

export const deleteReviewJobHandler = async (
  request: FastifyRequest<{ Params: { jobId: string } }>,
  reply: FastifyReply
): Promise<void> => {
  const { jobId } = request.params;
  await removeReviewJob({
    reviewJobId: jobId,
  });
  reply.code(200).send({
    success: true,
    data: {},
  });
};

export const getReviewResultItemsHandler = async (
  request: FastifyRequest<{
    Params: { jobId: string };
    Querystring: { parentId?: string; filter?: string; includeAllChildren?: string };
  }>,
  reply: FastifyReply
): Promise<void> => {
  const results = await getReviewResults({
    reviewJobId: request.params.jobId,
    parentId: request.query.parentId,
    filter: request.query.filter
      ? (request.query.filter as REVIEW_RESULT)
      : undefined,
    includeAllChildren: request.query.includeAllChildren === 'true',
  });
  reply.code(200).send({
    success: true,
    data: results,
  });
};

export interface OverrideReviewResultRequest {
  result: REVIEW_RESULT;
  userComment: string;
}

export const overrideReviewResultHandler = async (
  request: FastifyRequest<{
    Params: { jobId: string; resultId: string };
    Body: OverrideReviewResultRequest;
  }>,
  reply: FastifyReply
): Promise<void> => {
  const { jobId, resultId } = request.params;
  const { result, userComment } = request.body;

  await overrideReviewResult({
    reviewJobId: jobId,
    resultId,
    result,
    userComment,
  });

  reply.code(200).send({
    success: true,
    data: {},
  });
};
export const getReviewJobByIdHandler = async (
  request: FastifyRequest<{ Params: { jobId: string } }>,
  reply: FastifyReply
): Promise<void> => {
  const { jobId } = request.params;
  const job = await getReviewJobById({
    reviewJobId: jobId,
  });
  
  reply.code(200).send({
    success: true,
    data: job,
  });
};

interface GetDownloadPresignedUrlRequest {
  key: string;
  expiresIn?: number;
}

/**
 * ドキュメントのダウンロード用Presigned URLを取得するハンドラー
 */
export const getDownloadPresignedUrlHandler = async (
  request: FastifyRequest<{ Body: GetDownloadPresignedUrlRequest }>,
  reply: FastifyReply
): Promise<void> => {
  const { key, expiresIn = 3600 } = request.body;
  
  const url = await getDocumentDownloadUrl({
    key,
    expiresIn,
  });
  
  reply.code(200).send({
    success: true,
    data: {
      url,
    },
  });
};
