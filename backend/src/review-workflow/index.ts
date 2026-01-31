import { reviewErrorHandler } from "./handle-error";
import { prepareReview, finalizeReview } from "./review-processing";
import { preReviewItemProcessor } from "./review-preprocessing/pre-review-item";
import { postReviewItemProcessor } from "./review-postprocessing/post-review-item";
import { generateNextAction } from "./generate-next-action";

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
 * Next Action生成ハンドラー
 */
async function handleGenerateNextAction(event: any) {
  return await generateNextAction({
    reviewJobId: event.reviewJobId,
  });
}
