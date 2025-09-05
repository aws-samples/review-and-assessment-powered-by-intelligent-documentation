import { FastifyReply, FastifyRequest } from "fastify";
import {
  createChecklistSet,
  removeChecklistSet,
  getAllChecklistSets,
  getCheckListDocumentPresignedUrl,
  getChecklistItems,
  getChecklistSetById,
  duplicateChecklistSet,
} from "../usecase/checklist-set";
import { deleteS3Object } from "../../../core/s3";
import {
  createChecklistItem,
  getCheckListItem,
  modifyCheckListItem,
  removeCheckListItem,
} from "../usecase/checklist-item";
import { detectChecklistAmbiguity } from "../usecase/ambiguity-detection";
import { CHECK_LIST_STATUS } from "../domain/model/checklist";

interface Document {
  documentId: string;
  filename: string;
  s3Key: string;
  fileType: string;
}

/**
 * チェックリストセット作成リクエストの型定義
 */
export interface CreateChecklistSetRequest {
  name: string;
  description?: string;
  documents: Document[];
}

/**
 * チェックリスト複製リクエストの型定義
 */
export interface DuplicateChecklistSetRequest {
  Params: {
    checklistSetId: string;
  };
  Body: {
    name?: string;
    description?: string;
  };
}

/**
 * チェックリストセット作成ハンドラー
 */
export const createChecklistSetHandler = async (
  request: FastifyRequest<{ Body: CreateChecklistSetRequest }>,
  reply: FastifyReply
): Promise<void> => {
  await createChecklistSet({
    req: request.body,
    userId: request.user?.sub,
  });

  reply.code(200).send({
    success: true,
    data: {},
  });
};

/**
 * チェックリストセット削除ハンドラー
 */
export const deleteChecklistSetHandler = async (
  request: FastifyRequest<{ Params: { checklistSetId: string } }>,
  reply: FastifyReply
): Promise<void> => {
  const { checklistSetId } = request.params;
  await removeChecklistSet({
    checkListSetId: checklistSetId,
  });
  reply.code(200).send({
    success: true,
    data: {},
  });
};

/**
 * チェックリストセット複製ハンドラー
 */
export const duplicateChecklistSetHandler = async (
  request: FastifyRequest<DuplicateChecklistSetRequest>,
  reply: FastifyReply
): Promise<void> => {
  const { checklistSetId } = request.params;
  const { name, description } = request.body;

  await duplicateChecklistSet({
    sourceCheckListSetId: checklistSetId,
    newName: name,
    newDescription: description,
  });

  reply.code(200).send({
    success: true,
    data: {},
  });
};

/**
 * チェックリストセット一覧取得ハンドラー
 */
export const getAllChecklistSetsHandler = async (
  request: FastifyRequest<{
    Querystring: {
      status?: CHECK_LIST_STATUS;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    };
  }>,
  reply: FastifyReply
): Promise<void> => {
  const {
    status,
    page = 1,
    limit = 10,
    sortBy = "id",
    sortOrder = "desc",
  } = request.query;

  // Convert string query parameters to numbers
  const pageNum = typeof page === "string" ? parseInt(page, 10) : page;
  const limitNum = typeof limit === "string" ? parseInt(limit, 10) : limit;

  // Validate sortBy parameter - only allow valid fields
  const validSortFields = ["id", "name", "description", "createdAt"];
  const validSortBy = validSortFields.includes(sortBy) ? sortBy : "id";

  const result = await getAllChecklistSets({
    status,
    page: pageNum,
    limit: limitNum,
    sortBy: validSortBy,
    sortOrder,
  });

  reply.code(200).send({
    success: true,
    data: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      checkListSets: result.items.map((checkList: any) => ({
        checkListSetId: checkList.id,
        name: checkList.name,
        description: checkList.description,
        processingStatus: checkList.processingStatus,
        isEditable: checkList.isEditable,
        createdAt: checkList.createdAt,
      })),
    },
  });
};

interface GetPresignedUrlRequest {
  filename: string;
  contentType: string;
}

export const getChecklistPresignedUrlHandler = async (
  request: FastifyRequest<{ Body: GetPresignedUrlRequest }>,
  reply: FastifyReply
): Promise<void> => {
  const { filename, contentType } = request.body;

  const result = await getCheckListDocumentPresignedUrl({
    filename,
    contentType,
  });

  reply.code(200).send({
    success: true,
    data: result,
  });
};

export const deleteChecklistDocumentHandler = async (
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

export async function getChecklistItemsHandler(
  request: FastifyRequest<{
    Params: { setId: string };
    Querystring: { parentId?: string; includeAllChildren?: string };
  }>,
  reply: FastifyReply
): Promise<void> {
  const { setId } = request.params;
  const { parentId, includeAllChildren } = request.query;

  const items = await getChecklistItems({
    checkListSetId: setId,
    parentId: parentId,
    includeAllChildren: includeAllChildren === "true",
  });

  reply.code(200).send({
    success: true,
    data: {
      items,
    },
  });
}

export const getChecklistSetByIdHandler = async (
  request: FastifyRequest<{ Params: { setId: string } }>,
  reply: FastifyReply
): Promise<void> => {
  const { setId } = request.params;

  const detail = await getChecklistSetById({
    checkListSetId: setId,
  });

  reply.code(200).send({
    success: true,
    data: detail,
  });
};

export const getChecklistItemHandler = async (
  request: FastifyRequest<{ Params: { setId: string; itemId: string } }>,
  reply: FastifyReply
): Promise<void> => {
  const { itemId } = request.params;
  const detail = await getCheckListItem({
    itemId,
  });

  reply.code(200).send({
    success: true,
    data: {
      detail,
    },
  });
};

/**
 * チェックリスト項目作成リクエストの型定義
 */
export interface CreateChecklistItemRequest {
  Params: {
    setId: string;
  };
  Body: {
    name: string;
    description?: string;
    parentId?: string;
  };
}

export const createChecklistItemHandler = async (
  request: FastifyRequest<CreateChecklistItemRequest>,
  reply: FastifyReply
): Promise<void> => {
  await createChecklistItem({
    req: {
      Params: request.params,
      Body: request.body,
    },
  });

  reply.code(200).send({
    success: true,
    data: {},
  });
};

export interface UpdateChecklistItemRequest {
  Params: {
    setId: string;
    itemId: string;
  };
  Body: {
    name: string;
    description: string;
  };
}

export const updateChecklistItemHandler = async (
  request: FastifyRequest<UpdateChecklistItemRequest>,
  reply: FastifyReply
): Promise<void> => {
  const { setId, itemId } = request.params;
  const { name, description } = request.body;

  await modifyCheckListItem({
    req: {
      Params: { setId, itemId },
      Body: { name, description },
    },
  });

  reply.code(200).send({
    success: true,
    data: {},
  });
};

export const deleteChecklistItemHandler = async (
  request: FastifyRequest<{ Params: { setId: string; itemId: string } }>,
  reply: FastifyReply
): Promise<void> => {
  const { setId, itemId } = request.params;
  await removeCheckListItem({
    setId,
    itemId,
  });
  reply.code(200).send({
    success: true,
    data: {},
  });
};

export const detectAmbiguityHandler = async (
  request: FastifyRequest<{ Params: { setId: string } }>,
  reply: FastifyReply
): Promise<void> => {
  const { setId } = request.params;

  await detectChecklistAmbiguity({
    checkListSetId: setId,
    userId: request.user?.sub,
  });

  reply.code(200).send({
    success: true,
    data: {},
  });
};
