import { FastifyInstance } from "fastify";
import {
  createReviewJobHandler,
  deleteReviewDocumentHandler,
  deleteReviewJobHandler,
  getAllReviewJobsHandler,
  getReviewJobByIdHandler,
  getReviewPresignedUrlHandler,
  getReviewDocumentsPresignedUrlHandler,
  getReviewImagesPresignedUrlHandler,
  getReviewResultItemsHandler,
  overrideReviewResultHandler,
  getDownloadPresignedUrlHandler,
} from "./handlers";

/**
 * 審査機能のルート登録
 * @param fastify Fastifyインスタンス
 */
export function registerReviewRoutes(fastify: FastifyInstance): void {
  // 審査ドキュメント関連
  fastify.post("/documents/review/presigned-url", {
    handler: getReviewPresignedUrlHandler,
  });
  fastify.post("/documents/review/documents/presigned-url", {
    handler: getReviewDocumentsPresignedUrlHandler,
  });
  fastify.post("/documents/review/images/presigned-url", {
    handler: getReviewImagesPresignedUrlHandler,
  });
  fastify.delete("/documents/review/:key", {
    handler: deleteReviewDocumentHandler,
  });
  // ダウンロード用Presigned URL取得エンドポイント
  fastify.get("/documents/download-url", {
    handler: getDownloadPresignedUrlHandler,
  });

  // 審査ジョブ関連
  fastify.get("/review-jobs", {
    handler: getAllReviewJobsHandler,
  });
  fastify.get("/review-jobs/:jobId", {
    handler: getReviewJobByIdHandler,
  });
  fastify.post("/review-jobs", {
    handler: createReviewJobHandler,
  });
  fastify.delete("/review-jobs/:jobId", {
    handler: deleteReviewJobHandler,
  });

  // 審査結果関連
  fastify.get("/review-jobs/:jobId/results/items", {
    handler: getReviewResultItemsHandler,
  });
  fastify.put("/review-jobs/:jobId/results/:resultId", {
    handler: overrideReviewResultHandler,
  });
}
