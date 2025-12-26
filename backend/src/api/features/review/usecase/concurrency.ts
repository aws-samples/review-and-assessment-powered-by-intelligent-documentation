import { getQueueDepth } from "../../../core/sqs";

import { Logger } from "@aws-lambda-powertools/logger";

const serviceName = __filename; // 拡張子を除いたファイル名
const logger = new Logger({ serviceName });

export const computeGlobalConcurrency = async (): Promise<{
  isLimit: boolean;
}> => {
  logger.info("computeGlobalConcurrency called");
  // グローバル同時実行数チェック（SQSキュー深さ確認）
  const queueUrl = process.env.REVIEW_SQS_URL;
  const globalLimit = Number(process.env.REVIEW_GLOBAL_CONCURRENCY_LIMIT ?? 0);

  if (queueUrl && globalLimit > 0) {
    try {
      const depth = await getQueueDepth(queueUrl);
      logger.info("SQS queue depth fetched", { queueUrl, depth });
      if (depth.total >= globalLimit) {
        logger.warn("Global concurrency limit reached", { depth, globalLimit });
        return { isLimit: true };
      }
    } catch (e) {
      // エラーはログに出すだけで処理継続（最小変更重視）
      logger.error("Failed to check global concurrency:", e as Error);
    }
  }
  logger.info("Global concurrency check passed");
  return { isLimit: false };
};
