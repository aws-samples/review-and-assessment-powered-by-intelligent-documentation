import { ulid } from "ulid";
import {
  CreateChecklistItemRequest,
  CreateChecklistSetRequest,
} from "../../routes/handlers";
import { ParsedChecklistItem } from "../../../../../checklist-workflow/common/types";

// Added PrismaCheckList to avoid Prisma type dependency in the domain layer and to
// handle nullable/JSON fields conversion explicitly within the domain.
export type PrismaCheckList = {
  id: string;
  checkListSetId: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  toolConfigurationId?: string | null;
  feedbackSummary?: string | null;
  feedbackSummaryUpdatedAt?: Date | null;
  ambiguityReview?: any | null;
  documentId?: string | null;
};

export enum CHECK_LIST_STATUS {
  PENDING = "pending",
  PROCESSING = "processing",
  DETECTING = "detecting",
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
  userId: string;
  documents: ChecklistDocumentEntity[];
  processingStatus: CHECK_LIST_STATUS;
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
  userId?: string;
}

export interface CheckListItemEntity {
  id: string;
  parentId?: string;
  setId: string;
  name: string;
  description?: string;
  ambiguityReview?: AmbiguityDetectionResult;
  toolConfigurationId?: string;
  feedbackSummary?: string;
  feedbackSummaryUpdatedAt?: Date;
}

export interface CheckListItemDetail extends CheckListItemEntity {
  hasChildren: boolean;
  toolConfiguration?: {
    id: string;
    name: string;
  };
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

  createUpdatedItem: (
    existingItem: CheckListItemEntity,
    updates: { name: string; description: string; resolveAmbiguity: boolean }
  ): CheckListItemEntity => {
    const newAmbiguityReview = updates.resolveAmbiguity
      ? undefined
      : existingItem.ambiguityReview;

    console.log(
      "[DEBUG] createUpdatedItem - newAmbiguityReview:",
      newAmbiguityReview
    );

    return {
      ...existingItem,
      name: updates.name,
      description: updates.description || "",
      ambiguityReview: newAmbiguityReview,
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

  fromPrismaCheckListItem: (
    prismaItem: PrismaCheckList
  ): CheckListItemEntity => {
    return {
      id: prismaItem.id,
      setId: prismaItem.checkListSetId,
      name: prismaItem.name,
      description: prismaItem.description ?? undefined,
      parentId: prismaItem.parentId ?? undefined,
      toolConfigurationId: prismaItem.toolConfigurationId ?? undefined,
      feedbackSummary: prismaItem.feedbackSummary ?? undefined,
      feedbackSummaryUpdatedAt:
        prismaItem.feedbackSummaryUpdatedAt ?? undefined,
      ambiguityReview: (() => {
        const ar = prismaItem.ambiguityReview as unknown;
        if (!ar) return undefined;
        // ambiguityReview のスキーマは DB 側で柔軟に扱われているため暫定的に unknown として扱い、
        // 必要なプロパティを安全に取り出す（存在しない場合はデフォルトを使う）
        const suggestions = (ar as any).suggestions ?? [];
        const detectedAtRaw = (ar as any).detectedAt;
        const detectedAt = detectedAtRaw ? new Date(detectedAtRaw) : new Date();
        return { suggestions, detectedAt } as AmbiguityDetectionResult;
      })(),
    };
  },

  toPrismaCheckListItem: (item: CheckListItemEntity): PrismaCheckList => {
    return {
      id: item.id,
      name: item.name,
      description: item.description ?? null,
      checkListSetId: item.setId,
      parentId: item.parentId ?? null,
      documentId: null,
      toolConfigurationId: item.toolConfigurationId ?? null,
      feedbackSummary: item.feedbackSummary ?? null,
      feedbackSummaryUpdatedAt: item.feedbackSummaryUpdatedAt ?? null,
      ambiguityReview: item.ambiguityReview
        ? {
            suggestions: item.ambiguityReview.suggestions,
            detectedAt: item.ambiguityReview.detectedAt.toISOString(),
          }
        : null,
    };
  },

  fromPrismaCheckListItemWithDetail: (
    prismaItem: PrismaCheckList & {
      toolConfiguration?: { id: string; name: string } | null;
    },
    hasChildren: boolean
  ): CheckListItemDetail => {
    return {
      id: prismaItem.id,
      setId: prismaItem.checkListSetId,
      name: prismaItem.name,
      description: prismaItem.description ?? undefined,
      parentId: prismaItem.parentId ?? undefined,
      feedbackSummary: prismaItem.feedbackSummary ?? undefined,
      feedbackSummaryUpdatedAt:
        prismaItem.feedbackSummaryUpdatedAt ?? undefined,
      ambiguityReview: (() => {
        const ar = prismaItem.ambiguityReview as unknown;
        if (!ar) return undefined;
        const suggestions = (ar as any).suggestions ?? [];
        const detectedAtRaw = (ar as any).detectedAt;
        const detectedAt = detectedAtRaw ? new Date(detectedAtRaw) : new Date();
        return { suggestions, detectedAt } as AmbiguityDetectionResult;
      })(),
      hasChildren,
      toolConfiguration: prismaItem.toolConfiguration || undefined,
    };
  },
};
