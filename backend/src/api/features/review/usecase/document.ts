import { getDownloadPresignedUrl } from "../../../core/s3";

interface GetDocumentDownloadUrlParams {
  key: string;
  bucket?: string;
  expiresIn?: number;
}

/**
 * ドキュメントのダウンロード用Presigned URLを取得する
 */
export async function getDocumentDownloadUrl(
  params: GetDocumentDownloadUrlParams
): Promise<string> {
  const { key, bucket, expiresIn = 3600 } = params;
  const bucketName = bucket || process.env.DOCUMENT_BUCKET;

  if (!bucketName) {
    throw new Error(
      "Bucket name is not specified and DOCUMENT_BUCKET is not defined"
    );
  }

  return getDownloadPresignedUrl(bucketName, key, expiresIn);
}
