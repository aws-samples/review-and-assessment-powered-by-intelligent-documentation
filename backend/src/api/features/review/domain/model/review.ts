import {
  CheckListItemEntity,
  CheckListSetEntity,
} from "../../../checklist/domain/model/checklist";

/**
 * 審査ジョブのステータス
 */
export enum REVIEW_JOB_STATUS {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

/**
 * 審査結果のステータス
 */
export enum REVIEW_RESULT_STATUS {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

/**
 * 審査結果の評価
 */
export enum REVIEW_RESULT {
  PASS = "pass",
  FAIL = "fail",
}

/**
 * 審査ファイルタイプ
 */
export enum REVIEW_FILE_TYPE {
  PDF = "pdf",
  IMAGE = "image",
}

export interface ReviewJobStats {
  total: number;
  passed: number;
  failed: number;
  processing: number;
}

export interface ReviewJobEntity {
  id: string;
  name: string;
  status: REVIEW_JOB_STATUS;
  checkListSetId: string;
  userId?: string;
  documents: Array<{
    id: string;
    filename: string;
    s3Key: string;
    fileType: REVIEW_FILE_TYPE;
  }>;
  results: ReviewResultEntity[];
}

/**
 * ジョブ一覧表示用
 */
export interface ReviewJobSummary {
  id: string;
  name: string;
  status: REVIEW_JOB_STATUS;
  checkListSetId: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  userId?: string;
  documents: Array<{
    id: string;
    filename: string;
    s3Path: string;
    fileType: REVIEW_FILE_TYPE;
  }>;
  checkListSet: {
    id: string;
    name: string;
  };
  stats: ReviewJobStats;
}

/**
 * ジョブ結果画面のジョブ情報表示用
 */
export interface ReviewJobDetail {
  id: string;
  name: string;
  status: REVIEW_JOB_STATUS;
  errorDetail?: string;
  hasError: boolean;
  checkList: CheckListSetEntity;
  documents: Array<{
    id: string;
    filename: string;
    s3Path: string;
    fileType: REVIEW_FILE_TYPE;
  }>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCost?: number;
}

/**
 * 参照元情報
 */
export interface DocumentInfo {
  documentId: string;
  filename: string;
  pageNumber?: number; // PDFで使用
}

export interface SourceReference {
  documentId: string;
  pageNumber?: number;
  boundingBox?: {
    label: string;
    coordinates: [number, number, number, number]; // [x1, y1, x2, y2]
  };
}

export interface ReviewResultEntity {
  id: string;
  reviewJobId: string;
  checkId: string;
  status: REVIEW_RESULT_STATUS;
  result?: REVIEW_RESULT;
  confidenceScore?: number;
  explanation?: string;
  shortExplanation?: string;
  extractedText?: string;
  userComment?: string;
  userOverride: boolean;
  createdAt: Date;
  updatedAt: Date;
  sourceReferences?: SourceReference[];
  externalSources?: Array<{
    toolUseId: string;
    toolName: string;
    input?: any;
    output?: string;
    status?: "success" | "error" | "unknown";
  }>;
  reviewMeta?: any;
  inputTokens?: number;
  outputTokens?: number;
  totalCost?: number;
}

export interface ReviewResultDetail extends ReviewResultEntity {
  checkList: CheckListItemEntity;
  hasChildren: boolean;
}

export const ReviewResultDomain = (() => {
  const _buildSourceReferencesFromImages = (
    usedImageIndexes: number[] | undefined,
    imageBuffers: Array<{
      documentId: string;
      filename: string;
      buffer: Uint8Array;
    }>
  ): SourceReference[] => {
    // usedImageIndexesが指定されている場合は、その画像のみを使用
    if (usedImageIndexes && usedImageIndexes.length > 0) {
      return usedImageIndexes
        .filter((index) => index >= 0 && index < imageBuffers.length)
        .map((index) => ({
          documentId: imageBuffers[index].documentId,
        }));
    }

    // そうでない場合は全ての画像を使用
    return imageBuffers.map((img) => ({
      documentId: img.documentId,
    }));
  };

  return {
    fromOverrideRequest: (params: {
      current: ReviewResultDetail;
      result: REVIEW_RESULT;
      userComment: string;
    }): ReviewResultDetail => {
      const { current, result, userComment } = params;
      return {
        ...current,
        result,
        userComment,
        userOverride: true,
        updatedAt: new Date(),
      };
    },

    fromReviewData: (params: {
      current: ReviewResultDetail;
      result: REVIEW_RESULT;
      confidenceScore: number;
      explanation: string;
      shortExplanation: string;

      // 共通フィールド
      documents: DocumentInfo[];
      reviewType: "PDF" | "IMAGE";
      verificationDetails?: {
        sourcesDetails: Array<{
          toolUseId: string;
          toolName: string;
          input?: any;
          output?: string;
          status?: "success" | "error" | "unknown";
        }>;
      };
      reviewMeta?: any;
      inputTokens?: number;
      outputTokens?: number;
      totalCost?: number;

      // タイプ固有フィールド
      typeSpecificData?: {
        // PDF固有データ
        extractedText?: string;

        // 画像固有データ
        usedImageIndexes?: number[];
        boundingBoxes?: Array<{
          imageIndex: number;
          label: string;
          coordinates: [number, number, number, number];
        }>;
      };
    }): ReviewResultEntity => {
      const {
        current,
        result: reviewResult,
        confidenceScore,
        explanation,
        shortExplanation,
        documents,
        reviewType,
        verificationDetails,
        typeSpecificData,
      } = params;

      let sourceReferences: SourceReference[] = [];

      // レビュータイプによる分岐
      if (reviewType === "PDF") {
        // PDFのソース参照作成
        sourceReferences = documents.map((doc) => ({
          documentId: doc.documentId,
          pageNumber: doc.pageNumber || 1,
        }));
      } else {
        // IMAGE
        const { usedImageIndexes, boundingBoxes = [] } = typeSpecificData || {};

        // 使用された画像のみを対象とするか、すべての画像を対象とするか
        if (usedImageIndexes && usedImageIndexes.length > 0) {
          sourceReferences = usedImageIndexes
            .filter((index) => index >= 0 && index < documents.length)
            .map((index) => ({
              documentId: documents[index].documentId,
            }));
        } else {
          sourceReferences = documents.map((doc) => ({
            documentId: doc.documentId,
          }));
        }

        // バウンディングボックスの処理
        if (boundingBoxes && boundingBoxes.length > 0) {
          boundingBoxes.forEach((box) => {
            const imageIndex = box.imageIndex;
            if (imageIndex >= 0 && imageIndex < documents.length) {
              const documentId = documents[imageIndex].documentId;
              const existingRef = sourceReferences.find(
                (ref) => ref.documentId === documentId
              );

              if (existingRef) {
                existingRef.boundingBox = {
                  label: box.label,
                  coordinates: box.coordinates,
                };
              } else {
                sourceReferences.push({
                  documentId,
                  boundingBox: {
                    label: box.label,
                    coordinates: box.coordinates,
                  },
                });
              }
            }
          });
        }
      }

      // 共通返却値
      const resultEntity: ReviewResultEntity = {
        ...current,
        status: REVIEW_RESULT_STATUS.COMPLETED,
        result: reviewResult,
        confidenceScore,
        explanation,
        shortExplanation,
        sourceReferences,
        externalSources: verificationDetails?.sourcesDetails || undefined,
        userOverride: false,
        updatedAt: new Date(),
        reviewMeta: params.reviewMeta,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        totalCost: params.totalCost,
      };

      // PDFの場合のみ抽出テキストを追加
      if (reviewType === "PDF" && typeSpecificData?.extractedText) {
        resultEntity.extractedText = typeSpecificData.extractedText;
      }

      return resultEntity;
    },

    parseSourceReferences: (
      documentId: string,
      pageNumberOrIndices?: string | number
    ): SourceReference[] => {
      if (pageNumberOrIndices === undefined) {
        return [{ documentId }];
      }

      // 文字列の場合（カンマ区切りの可能性あり）
      if (typeof pageNumberOrIndices === "string") {
        // カンマ区切りの場合は複数の参照元を作成
        if (pageNumberOrIndices.includes(",")) {
          return pageNumberOrIndices.split(",").map((index) => ({
            documentId,
            pageNumber: parseInt(index.trim(), 10),
          }));
        }
        // 単一の値の場合
        return [
          {
            documentId,
            pageNumber: parseInt(pageNumberOrIndices, 10),
          },
        ];
      }

      // 数値の場合
      return [
        {
          documentId,
          pageNumber: pageNumberOrIndices,
        },
      ];
    },
  };
})();
