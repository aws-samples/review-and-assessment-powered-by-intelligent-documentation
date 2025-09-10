import { ulid } from "ulid";
import {
  CreateChecklistItemRequest,
  CreateChecklistSetRequest,
  UpdateChecklistItemRequest,
} from "../../routes/handlers";
import { ParsedChecklistItem } from "../../../../../checklist-workflow/common/types";
import type { CheckList } from "../../../../../../prisma/client";

export enum CHECK_LIST_STATUS {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface AmbiguityDetectionResult {
  suggestions: string[];
  detectedAt: Date;
}

export enum AmbiguityFilter {
  ALL = "all",
  HAS_AMBIGUITY = "hasAmbiguity",
}

export interface CheckListSetEntity {
  id: string;
  name: string;
  description: string;
  documents: ChecklistDocumentEntity[];
  createdAt: Date;
}

// 一覧取得用
export interface CheckListSetSummary {
  id: string;
  name: string;
  description: string;
  processingStatus: CHECK_LIST_STATUS;
  isEditable: boolean;
  createdAt: Date;
}

// 詳細取得用
export interface CheckListSetDetailModel {
  id: string;
  name: string;
  description: string;
  documents: ChecklistDocumentEntity[];
  isEditable: boolean;
  errorSummary?: string;
  hasError: boolean;
}

export interface ChecklistDocumentEntity {
  id: string;
  filename: string;
  s3Key: string;
  fileType: string;
  uploadDate: Date;
  status: CHECK_LIST_STATUS;
  errorDetail?: string;
}

export interface CheckListItemEntity {
  id: string;
  parentId?: string;
  setId: string;
  name: string;
  description?: string;
  ambiguityReview?: AmbiguityDetectionResult;
}

export interface CheckListItemDetail extends CheckListItemEntity {
  hasChildren: boolean;
}

export const CheckListSetDomain = {
  fromCreateRequest: (req: CreateChecklistSetRequest): CheckListSetEntity => {
    const { name, description, documents } = req;
    return {
      id: ulid(),
      name,
      description: description || "",
      documents: documents.map((doc) => ({
        id: doc.documentId,
        filename: doc.filename,
        s3Key: doc.s3Key,
        fileType: doc.fileType,
        uploadDate: new Date(),
        status: CHECK_LIST_STATUS.PENDING,
      })),
      createdAt: new Date(),
    };
  },

  fromDuplicateRequest: (
    sourceId: string,
    newName: string | undefined,
    newDescription: string | undefined,
    source: CheckListSetDetailModel
  ): CheckListSetEntity => {
    return {
      id: ulid(),
      name: newName || `${source.name} (コピー)`,
      description:
        newDescription !== undefined ? newDescription : source.description,
      documents: source.documents.map((doc) => ({
        id: ulid(),
        filename: doc.filename,
        s3Key: doc.s3Key,
        fileType: doc.fileType,
        uploadDate: new Date(),
        status: CHECK_LIST_STATUS.COMPLETED, // 複製時は完了状態に設定
      })),
      createdAt: new Date(),
    };
  },
};

export const CheckListItemDomain = {
  fromCreateRequest: (req: CreateChecklistItemRequest): CheckListItemEntity => {
    const { Body } = req;
    const { name, description, parentId } = Body;

    return {
      id: ulid(),
      setId: req.Params.setId,
      name,
      description: description || "",
      parentId: parentId || undefined,
    };
  },

  fromUpdateRequest: (req: UpdateChecklistItemRequest): CheckListItemEntity => {
    const { Params, Body } = req;
    const { name, description } = Body;

    return {
      id: Params.itemId,
      setId: Params.setId,
      name,
      description: description || "",
    };
  },

  fromParsedChecklistItem: (params: {
    setId: string;
    item: ParsedChecklistItem;
  }): CheckListItemEntity => {
    const { id, name, description, parent_id } = params.item;
    return {
      id,
      setId: params.setId,
      name,
      description: description || "",
      parentId: parent_id ? String(parent_id) : undefined,
    };
  },

  fromPrismaCheckListItem: (prismaItem: CheckList): CheckListItemEntity => {
    return {
      id: prismaItem.id,
      setId: prismaItem.checkListSetId,
      name: prismaItem.name,
      description: prismaItem.description ?? undefined,
      parentId: prismaItem.parentId ?? undefined,
      ambiguityReview: prismaItem.ambiguityReview
        ? {
            suggestions: (prismaItem.ambiguityReview as any).suggestions || [],
            detectedAt: new Date(
              (prismaItem.ambiguityReview as any).detectedAt
            ),
          }
        : undefined,
    };
  },

  toPrismaCheckListItem: (item: CheckListItemEntity): CheckList => {
    return {
      id: item.id,
      name: item.name,
      description: item.description ?? null,
      checkListSetId: item.setId,
      parentId: item.parentId ?? null,
      documentId: null,
      ambiguityReview: item.ambiguityReview
        ? {
            suggestions: item.ambiguityReview.suggestions,
            detectedAt: item.ambiguityReview.detectedAt.toISOString(),
          }
        : null,
    };
  },
};
