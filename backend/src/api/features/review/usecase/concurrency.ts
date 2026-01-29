import { getQueueDepth } from "../../../core/sqs";



export const computeGlobalConcurrency = async (): Promise<{
  isLimit: boolean;
}> => {
  console.info("computeGlobalConcurrency called");
  // グローバル同時実行数チェック（SQSキュー深さ確認）
  const queueUrl = process.env.REVIEW_QUEUE_URL || process.env.REVIEW_SQS_URL;
  const globalLimit = Number(process.env.REVIEW_GLOBAL_CONCURRENCY_LIMIT ?? 0);

  if (queueUrl && globalLimit > 0) {
    try {
      const depth = await getQueueDepth(queueUrl);
      console.info("SQS queue depth fetched", { queueUrl, depth });
      if (depth.total >= globalLimit) {
        console.warn("Global concurrency limit reached", { depth, globalLimit });
        return { isLimit: true };
      }
    } catch (e) {
      // エラーはログに出すだけで処理継続（最小変更重視）
      console.error("Failed to check global concurrency:", e as Error);
    }
  } else {
    console.info("Global concurrency check skipped", {
      queueUrl,
      globalLimit,
    });
  }
  console.info("Global concurrency check passed");
  return { isLimit: false };
};
