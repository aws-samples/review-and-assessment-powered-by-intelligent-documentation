/**
 * ドキュメントアップロード用のカスタムフック
 * ファイル選択時にpresigned URLを取得し、S3へのアップロードを行う
 */
import { useState } from "react";
import useHttp from "./useHttp";
import { GetReviewImagesPresignedUrlResponse } from "../features/review/types";

/**
 * Presigned URL レスポンス
 */
interface PresignedUrlResponse {
  success: boolean;
  data: {
    url: string;
    key: string;
    documentId: string;
  };
  error?: string;
}

/**
 * ドキュメントアップロード結果
 */
export interface DocumentUploadResult {
  documentId: string;
  filename: string;
  s3Key: string;
  fileType: string;
}

interface UseDocumentUploadOptions {
  presignedUrlEndpoint?: string;
  /** 複数ドキュメント（PDF等）の presigned URL 一括取得エンドポイント */
  documentsPresignedUrlEndpoint?: string;
  imagesPresignedUrlEndpoint?: string;
  deleteEndpointPrefix?: string;
  isImageMode?: boolean;
}

/**
 * ドキュメントアップロード用のカスタムフック
 */
export function useDocumentUpload(options: UseDocumentUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<
    DocumentUploadResult[]
  >([]);
  const http = useHttp();

  const presignedUrlEndpoint =
    options.presignedUrlEndpoint || "/documents/presigned-url";
  const documentsPresignedUrlEndpoint =
    options.documentsPresignedUrlEndpoint ||
    "/documents/review/documents/presigned-url";
  const imagesPresignedUrlEndpoint =
    options.imagesPresignedUrlEndpoint ||
    "/documents/review/images/presigned-url";
  const deleteEndpointPrefix = options.deleteEndpointPrefix || "/documents/";

  /**
   * ファイルをアップロードする
   * @param file アップロードするファイル
   * @returns アップロード結果
   */
  const uploadDocument = async (file: File): Promise<DocumentUploadResult> => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Presigned URLを取得
      const presignedResponse = await http.post<PresignedUrlResponse>(
        presignedUrlEndpoint,
        {
          filename: file.name,
          contentType: file.type,
        }
      );

      if (!presignedResponse.data.success) {
        throw new Error(
          presignedResponse.data.error || "Failed to get presigned URL"
        );
      }

      const { url, key, documentId } = presignedResponse.data.data;

      // S3にファイルをアップロード
      const uploadResponse = await fetch(url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
      }

      // アップロード結果を設定
      const result: DocumentUploadResult = {
        documentId,
        filename: file.name,
        s3Key: key,
        fileType: file.type,
      };

      setUploadedDocuments((prev) => [...prev, result]);
      setUploadProgress(100);

      return result;
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Failed to upload document");
      setError(err);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * 複数ファイルをアップロードする
   * @param files アップロードするファイル配列
   * @param endpoint presigned URL一括取得のエンドポイント。
   *                 省略時は画像用（後方互換）。PDF等は documentsPresignedUrlEndpoint を渡す
   * @returns アップロード結果の配列
   */
  const uploadDocuments = async (
    files: File[],
    endpoint: string = imagesPresignedUrlEndpoint
  ): Promise<DocumentUploadResult[]> => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // presigned URLを一括取得
      const presignedResponse =
        await http.post<GetReviewImagesPresignedUrlResponse>(endpoint, {
          filenames: files.map((f) => f.name),
          contentTypes: files.map((f) => f.type),
        });

      if (!presignedResponse.data.success) {
        throw new Error(
          presignedResponse.data.error || "Failed to get presigned URLs"
        );
      }

      const { files: presignedFiles } = presignedResponse.data.data;

      // 各ファイルを並行してアップロード
      const uploadPromises = presignedFiles.map(async (presigned, index) => {
        const file = files[index];
        const uploadResponse = await fetch(presigned.url, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(
            `Failed to upload file: ${uploadResponse.statusText}`
          );
        }

        return {
          documentId: presigned.documentId,
          filename: file.name,
          s3Key: presigned.key,
          fileType: file.type,
        };
      });

      const results = await Promise.all(uploadPromises);
      setUploadedDocuments((prev) => [...prev, ...results]);
      setUploadProgress(100);

      return results;
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new Error("Failed to upload documents");
      setError(err);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * アップロードをキャンセルする
   */
  const cancelUpload = () => {
    // 実装が必要な場合はここに追加
    setIsUploading(false);
    setUploadProgress(0);
  };

  /**
   * アップロードしたドキュメントを削除する
   */
  const deleteDocument = async (documentId: string): Promise<boolean> => {
    try {
      const response = await http.delete<{ success: boolean }>(
        `${deleteEndpointPrefix}${documentId}`
      );

      if (response.data.success) {
        removeDocument(documentId);
      }

      return response.data.success;
    } catch (error) {
      console.error("Failed to delete document", error);
      return false;
    }
  };

  /**
   * アップロードしたドキュメントをリストから削除する（S3からは削除しない）
   */
  const removeDocument = (documentId: string) => {
    setUploadedDocuments((prev) =>
      prev.filter((doc) => doc.documentId !== documentId)
    );
  };

  /**
   * アップロードしたドキュメントリストをクリアする
   */
  const clearUploadedDocuments = () => {
    setUploadedDocuments([]);
  };

  return {
    uploadDocument,
    uploadDocuments,
    cancelUpload,
    deleteDocument,
    removeDocument,
    clearUploadedDocuments,
    isUploading,
    uploadProgress,
    error,
    uploadedDocuments,
    // 呼び出し側が uploadDocuments に渡せるよう公開する
    documentsPresignedUrlEndpoint,
    imagesPresignedUrlEndpoint,
  };
}
