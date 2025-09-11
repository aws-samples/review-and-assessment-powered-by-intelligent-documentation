/**
 * チェックリスト項目関連のルート定義
 */
import { FastifyInstance } from "fastify";
import {
  createChecklistItemHandler,
  createChecklistSetHandler,
  deleteChecklistDocumentHandler,
  deleteChecklistItemHandler,
  deleteChecklistSetHandler,
  getChecklistItemHandler,
  getChecklistPresignedUrlHandler,
  getChecklistItemsHandler,
  getChecklistSetByIdHandler,
  updateChecklistItemHandler,
  getAllChecklistSetsHandler,
  duplicateChecklistSetHandler,
  detectAmbiguityHandler,
} from "./handlers";

/**
 * チェックリスト関連のルートを登録
 * @param fastify Fastifyインスタンス
 */
export function registerChecklistRoutes(fastify: FastifyInstance): void {
  // チェックリストセット一覧取得エンドポイント
  fastify.get("/checklist-sets", {
    handler: getAllChecklistSetsHandler,
  });

  // チェックリストセット詳細取得エンドポイント
  fastify.get("/checklist-sets/:setId", {
    handler: getChecklistSetByIdHandler,
  });

  // チェックリストセット作成エンドポイント
  fastify.post("/checklist-sets", {
    handler: createChecklistSetHandler,
  });

  // チェックリストセット削除エンドポイント
  fastify.delete("/checklist-sets/:checklistSetId", {
    handler: deleteChecklistSetHandler,
  });

  // チェックリストセット複製エンドポイント
  fastify.post("/checklist-sets/:checklistSetId/duplicate", {
    handler: duplicateChecklistSetHandler,
  });

  // チェックリストドキュメントpresigned-url取得エンドポイント
  fastify.post("/documents/checklist/presigned-url", {
    handler: getChecklistPresignedUrlHandler,
  });
  // チェックリストドキュメント削除エンドポイント
  fastify.delete("/documents/checklist/:key", deleteChecklistDocumentHandler);

  // チェックリスト項目一覧取得エンドポイント
  fastify.get("/checklist-sets/:setId/items", {
    handler: getChecklistItemsHandler,
  });

  // チェックリスト項目詳細取得エンドポイント
  fastify.get("/checklist-sets/:setId/items/:itemId", {
    handler: getChecklistItemHandler,
  });

  // チェックリスト項目作成エンドポイント
  fastify.post("/checklist-sets/:setId/items", {
    handler: createChecklistItemHandler,
  });

  // チェックリスト項目更新エンドポイント
  fastify.put("/checklist-sets/:setId/items/:itemId", {
    handler: updateChecklistItemHandler,
  });

  // チェックリスト項目削除エンドポイント
  fastify.delete("/checklist-sets/:setId/items/:itemId", {
    handler: deleteChecklistItemHandler,
  });

  // 曖昧さ検知エンドポイント
  fastify.post("/checklist-sets/:setId/detect-ambiguity", {
    handler: detectAmbiguityHandler,
  });
}
