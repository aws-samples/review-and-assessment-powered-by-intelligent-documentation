import { reviewErrorHandler } from "./handle-error";
import { prepareReview, finalizeReview } from "./review-processing";
import { preReviewItemProcessor } from "./review-preprocessing/pre-review-item";
import { postReviewItemProcessor } from "./review-postprocessing/post-review-item";
import { generateNextAction } from "./generate-next-action";
import { preGenerateNextAction } from "./generate-next-action-preprocessing/pre-generate-next-action";
import { postGenerateNextAction } from "./generate-next-action-postprocessing/post-generate-next-action";

export const handler = async (event: any): Promise<any> => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  // アクションタイプに基づいて処理を分岐
  switch (event.action) {
    case "prepareReview":
      return await handlePrepareReview(event);
    case "finalizeReview":
      return await handleFinalizeReview(event);
    case "generateNextAction":
      return await handleGenerateNextAction(event);
    case "preGenerateNextAction":
      return await handlePreGenerateNextAction(event);
    case "postGenerateNextAction":
      return await handlePostGenerateNextAction(event);
    case "handleReviewError":
      return await handleReviewError(event);
    case "preReviewItemProcessor":
      return await preReviewItemProcessor(event);
    case "postReviewItemProcessor":
      return await postReviewItemProcessor(event);
    default:
      throw new Error(`未知のアクション: ${event.action}`);
  }
};

/**
 * 審査準備ハンドラー
 */
async function handlePrepareReview(event: any) {
  return await prepareReview({
    reviewJobId: event.reviewJobId,
  });
}

/**
 * 審査結果集計ハンドラー
 */
async function handleFinalizeReview(event: any) {
  return await finalizeReview({
    reviewJobId: event.reviewJobId,
    processedItems: event.processedItems,
  });
}

/**
 * エラーハンドリングハンドラー
 */
async function handleReviewError(event: any) {
  await reviewErrorHandler(event);
}

/**
 * Next Action生成ハンドラー（レガシー - 直接Bedrock呼び出し）
 */
async function handleGenerateNextAction(event: any) {
  return await generateNextAction({
    reviewJobId: event.reviewJobId,
  });
}

/**
 * Next Action生成前処理ハンドラー（Strands Agent用）
 */
async function handlePreGenerateNextAction(event: any) {
  return await preGenerateNextAction({
    reviewJobId: event.reviewJobId,
    userId: event.userId,
  });
}

/**
 * Next Action生成後処理ハンドラー（Strands Agent用）
 */
async function handlePostGenerateNextAction(event: any) {
  return await postGenerateNextAction({
    reviewJobId: event.reviewJobId,
    agentResult: event.agentResult,
  });
}
