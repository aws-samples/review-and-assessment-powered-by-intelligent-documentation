/**
 * ダウンロード用のPresigned URLを取得するカスタムフック
 */
import { useState, useCallback } from "react";
import { useApiClient } from "./useApiClient";
import useHttp from "./useHttp";

interface UsePresignedDownloadUrlOptions {
  expiresIn?: number; // 有効期限（秒）
  endpoint?: string; // エンドポイントをオプションで指定可能に
}

interface PresignedUrlResponse {
  url: string;
}

/**
 * ダウンロード用のPresigned URLを取得するカスタムフック
 *
 * @example
 * // 基本的な使用方法（デフォルトエンドポイント）
 * const { getPresignedUrl } = usePresignedDownloadUrl();
 * const url = await getPresignedUrl('path/to/file.pdf');
 *
 * @example
 * // 特定の機能用にエンドポイントを指定
 * const { getPresignedUrl } = usePresignedDownloadUrl({
 *   endpoint: '/documents/review/download-url'
 * });
 * const url = await getPresignedUrl('path/to/file.pdf');
 */
export function usePresignedDownloadUrl(
  options: UsePresignedDownloadUrlOptions = {}
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const http = useHttp();

  const expiresIn = options.expiresIn || 3600; // デフォルト1時間
  const endpoint = options.endpoint || "/documents/download-url"; // デフォルトエンドポイント

  /**
   * S3キーからpresigned URLを取得する
   */
  const getPresignedUrl = useCallback(
    async (s3Key: string, bucketName?: string): Promise<string> => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          key: s3Key,
          expiresIn: expiresIn.toString(),
        });

        if (bucketName) {
          params.append("bucket", bucketName);
        }

        const response = await http.getOnce<{
          success: boolean;
          data: { url: string };
          error?: string;
        }>(`${endpoint}?${params.toString()}`);

        if (!response.data.success) {
          throw new Error(response.data.error || "Failed to get presigned URL");
        }

        return response.data.data.url;
      } catch (error) {
        const err =
          error instanceof Error
            ? error
            : new Error("Failed to get presigned URL");
        setError(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [http, endpoint, expiresIn]
  );

  /**
   * PDFのページ付きURLを取得する
   */
  const getPdfPageUrl = useCallback(
    async (s3Key: string, pageNumber: number): Promise<string> => {
      const url = await getPresignedUrl(s3Key);
      return `${url}#page=${pageNumber}`;
    },
    [getPresignedUrl]
  );

  return {
    getPresignedUrl,
    getPdfPageUrl,
    isLoading,
    error,
  };
}
