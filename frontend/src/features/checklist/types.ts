/**
 * Checklist feature type definitions
 * These types correspond to the backend API endpoints in backend/src/api/features/checklist/routes
 */

import { ApiResponse } from "../../types/api";

// Common types
export interface Document {
  documentId: string;
  filename: string;
  s3Key: string;
  fileType: string;
}

export interface AmbiguityDetectionResult {
  suggestions: string[];
  detectedAt: string;
}

export enum AmbiguityFilter {
  ALL = "all",
  HAS_AMBIGUITY = "hasAmbiguity",
}

export enum CHECK_LIST_STATUS {
  PENDING = "pending",
  PROCESSING = "processing",
  DETECTING = "detecting",
  COMPLETED = "completed",
  FAILED = "failed",
}

// Request types

/**
 * Request type for creating a checklist set
 * POST /checklist-sets
 */
export interface CreateChecklistSetRequest {
  name: string;
  description?: string;
  documents: Document[];
  templateId?: string; // プロンプトテンプレートID
}

/**
 * Request type for duplicating a checklist set
 * POST /checklist-sets/:checklistSetId/duplicate
 */
export interface DuplicateChecklistSetRequest {
  name?: string;
  description?: string;
}

/**
 * Request type for getting a presigned URL for checklist document upload
 * POST /documents/checklist/presigned-url
 */
export interface GetChecklistPresignedUrlRequest {
  filename: string;
  contentType: string;
}

/**
 * Request type for creating a checklist item
 * POST /checklist-sets/:setId/items
 */
export interface CreateChecklistItemRequest {
  name: string;
  description?: string;
  parentId?: string;
}

/**
 * Request type for updating a checklist item
 * PUT /checklist-sets/:setId/items/:itemId
 */
export interface UpdateChecklistItemRequest {
  name: string;
  description: string;
  resolveAmbiguity: boolean;
}

// Response types

/**
 * Response type for getting all checklist sets
 * GET /checklist-sets
 */
export type GetAllChecklistSetsResponse = ApiResponse<{
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  checkListSets: {
    checkListSetId: string;
    name: string;
    description: string;
    processingStatus: CHECK_LIST_STATUS;
    isEditable: boolean;
    createdAt: string;
  }[];
}>;

/**
 * Response type for getting a presigned URL for checklist document upload
 * POST /documents/checklist/presigned-url
 */
export type GetChecklistPresignedUrlResponse = ApiResponse<{
  url: string;
  key: string;
  documentId: string;
}>;

/**
 * Response type for deleting a checklist document
 * DELETE /documents/checklist/:key
 */
export type DeleteChecklistDocumentResponse = ApiResponse<{
  deleted: boolean;
}>;

/**
 * Response type for getting checklist set detail
 * GET /checklist-sets/:setId
 */
export type GetChecklistSetResponse = ApiResponse<CheckListSetDetailModel>;

/**
 * Response type for getting checklist items
 * GET /checklist-sets/:setId/items
 */
export type GetChecklistItemsResponse = ApiResponse<{
  items: CheckListItemDetail[];
}>;

/**
 * Response type for getting a checklist item
 * GET /checklist-sets/:setId/items/:itemId
 */
export type GetChecklistItemResponse = ApiResponse<{
  detail: CheckListItemEntity;
}>;

/**
 * Response type for creating a checklist set
 * POST /checklist-sets
 */
export type CreateChecklistSetResponse = ApiResponse<Record<string, never>>;

/**
 * Response type for duplicating a checklist set
 * POST /checklist-sets/:checklistSetId/duplicate
 */
export type DuplicateChecklistSetResponse = ApiResponse<Record<string, never>>;

/**
 * Response type for deleting a checklist set
 * DELETE /checklist-sets/:id
 */
export type DeleteChecklistSetResponse = ApiResponse<Record<string, never>>;

/**
 * Response type for creating a checklist item
 * POST /checklist-sets/:setId/items
 */
export type CreateChecklistItemResponse = ApiResponse<Record<string, never>>;

/**
 * Response type for updating a checklist item
 * PUT /checklist-sets/:setId/items/:itemId
 */
export type UpdateChecklistItemResponse = ApiResponse<Record<string, never>>;

/**
 * Response type for deleting a checklist item
 * DELETE /checklist-sets/:setId/items/:itemId
 */
export type DeleteChecklistItemResponse = ApiResponse<Record<string, never>>;

export interface DetectAmbiguityRequest {}
export type DetectAmbiguityResponse = ApiResponse<Record<string, never>>;

// Model types

/**
 * Checklist item entity model
 */
export interface CheckListItemEntity {
  id: string;
  parentId?: string;
  setId: string;
  name: string;
  description?: string;
  ambiguityReview?: AmbiguityDetectionResult;
}

/**
 * Checklist item detail model with hasChildren flag
 */
export interface CheckListItemDetail extends CheckListItemEntity {
  hasChildren: boolean;
  toolConfiguration?: {
    id: string;
    name: string;
  };
}

/**
 * Checklist document entity model
 */
export interface ChecklistDocumentEntity {
  id: string;
  filename: string;
  s3Key: string;
  fileType: string;
  uploadDate: Date;
  status: CHECK_LIST_STATUS;
  errorDetail?: string;
}

/**
 * Checklist set entity model
 */
export interface CheckListSetEntity {
  id: string;
  name: string;
  description: string;
  documents: ChecklistDocumentEntity[];
}

/**
 * Checklist set detail model
 */
export interface CheckListSetDetailModel {
  id: string;
  name: string;
  description: string;
  documents: ChecklistDocumentEntity[];
  processingStatus: CHECK_LIST_STATUS;
  isEditable: boolean;
  errorSummary?: string;
  hasError: boolean;
  enableNextAction?: boolean;
  nextActionTemplateId?: string;
}

/**
 * Checklist set summary model (for list view)
 */
export interface CheckListSetSummary {
  id: string;
  name: string;
  description: string;
  processingStatus: CHECK_LIST_STATUS;
  isEditable: boolean;
  createdAt: string;
  documents?: ChecklistDocumentEntity[];
}
