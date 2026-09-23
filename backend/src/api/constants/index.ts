export const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB (Bedrock Converse API制限)

/**
 * 1つの審査ジョブに指定できるドキュメントの最大数。
 *
 * Presigned URL 発行時と審査ジョブ作成時の両方で同じ値を使う。
 * 片方だけ変更されると、アップロードは通るのにジョブ作成で弾かれる。
 */
export const MAX_REVIEW_DOCUMENTS = 20;
