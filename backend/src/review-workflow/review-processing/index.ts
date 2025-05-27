import {
  makePrismaReviewJobRepository,
  makePrismaReviewResultRepository,
} from "../../api/features/review/domain/repository";
import {
  REVIEW_FILE_TYPE,
  REVIEW_JOB_STATUS,
  REVIEW_RESULT_STATUS,
} from "../../api/features/review/domain/model/review";
import { updateCheckResultCascade } from "../../api/features/review/domain/service/review-result-cascade-update";

/**
 * 審査準備パラメータ
 */
interface PrepareReviewParams {
  reviewJobId: string;
}

/**
 * 審査結果集計パラメータ
 */
interface FinalizeReviewParams {
  reviewJobId: string;
  processedItems: any[];
}

/**
 * 審査準備処理
 * チェックリスト項目を取得し、処理項目を準備する
 */
export async function prepareReview(params: PrepareReviewParams): Promise<any> {
  const { reviewJobId } = params;
  const reviewJobRepository = await makePrismaReviewJobRepository();
  const reviewResultRepository = await makePrismaReviewResultRepository();

  try {
    // ジョブのステータスを処理中に更新
    await reviewJobRepository.updateJobStatus({
      reviewJobId,
      status: REVIEW_JOB_STATUS.PROCESSING,
    });

    // ジョブに関連するドキュメント情報を取得
    const jobDetail = await reviewJobRepository.findReviewJobById({
      reviewJobId,
    });

    if (!jobDetail.documents || jobDetail.documents.length === 0) {
      throw new Error(`No documents found for review job ${reviewJobId}`);
    }

    // job取得
    const results = await reviewResultRepository.findReviewResultsById({
      jobId: reviewJobId,
      includeAllChildren: true, // すべての項目を取得
    });

    // 子項目を持つ親項目のIDを特定
    const childrenMap = new Map<string, string[]>();
    results.forEach((r) => {
      const pid = r.checkList.parentId;
      if (pid) {
        if (!childrenMap.has(pid)) {
          childrenMap.set(pid, []);
        }
        childrenMap.get(pid)!.push(r.checkId);
      }
    });

    // 子項目を持つ親項目をスキップし、子項目のみまたは子項目を持たない項目のみを処理対象とする
    const checkItems = results
      .filter((result) => !childrenMap.has(result.checkId))
      .map((result) => ({
        checkId: result.checkList.id,
        reviewResultId: result.id,
      }));

    return {
      reviewJobId,
      documents: jobDetail.documents,
      checkItems,
    };
  } catch (error) {
    console.error(`Error preparing review job ${reviewJobId}:`, error);
    throw error;
  }
}

/**
 * 審査結果集計処理
 * 審査結果を集計し、親子関係の結果を更新する
 */
export async function finalizeReview(
  params: FinalizeReviewParams
): Promise<any> {
  const { reviewJobId, processedItems } = params;
  const reviewJobRepository = await makePrismaReviewJobRepository();
  const reviewResultRepository = await makePrismaReviewResultRepository();

  try {
    // 1. 審査結果の取得 - 空の親ID（ルート）から始める
    const results = await reviewResultRepository.findReviewResultsById({
      jobId: reviewJobId,
      includeAllChildren: true, // すべての項目を取得
    });

    if (results.length === 0) {
      throw new Error(`No review results found for job ${reviewJobId}`);
    }

    // 2. 親子関係の処理と結果更新
    // すべての子ノードについて親の結果を更新する
    for (const result of results) {
      if (result.status === REVIEW_RESULT_STATUS.COMPLETED) {
        // 更新されたノードをもとに、必要な親ノードのカスケード更新を実行
        await updateCheckResultCascade({
          updated: result,
          deps: {
            reviewResultRepo: reviewResultRepository,
          },
        });
      }
    }

    // 3. ジョブのステータスを完了に更新
    await reviewJobRepository.updateJobStatus({
      reviewJobId,
      status: REVIEW_JOB_STATUS.COMPLETED,
    });

    return {
      status: "success",
      reviewJobId,
      message: "Review processing completed",
    };
  } catch (error) {
    console.error(`Error finalizing review job ${reviewJobId}:`, error);
    throw error;
  }
}
