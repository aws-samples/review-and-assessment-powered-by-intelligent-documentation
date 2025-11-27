import { NotFoundError } from "../../../../core/errors";
import {
  REVIEW_RESULT_STATUS,
  ReviewResultEntity,
  REVIEW_RESULT,
  ReviewResultDetail,
} from "../model/review";
import { ReviewResultRepository } from "../repository";

export const updateCheckResultCascade = async (params: {
  updated: ReviewResultDetail;
  deps: {
    reviewResultRepo: ReviewResultRepository;
  };
}): Promise<void> => {
  const {
    updated,
    deps: { reviewResultRepo },
  } = params;

  // まず更新対象のノード自体を更新
  await reviewResultRepo.updateResult({
    newResult: updated,
  });

  // 1) Fetch all review results for the given review job
  const all = await reviewResultRepo.findReviewResultsById({
    jobId: updated.reviewJobId,
    includeAllChildren: true,
  });
  if (all.length === 0) {
    throw new NotFoundError(`Review job not found`, updated.reviewJobId);
  }

  // 2) Create a map to store the review results and their children
  const modelMap = new Map<string, ReviewResultDetail>();
  const childrenMap = new Map<string, string[]>();
  all.forEach((r) => {
    modelMap.set(r.checkId, { ...r });
    const pid = r.checkList.parentId;
    if (pid) {
      if (!childrenMap.has(pid)) {
        childrenMap.set(pid, []);
      }
      childrenMap.get(pid)!.push(r.checkId);
    }
  });

  // 3) Update the status of the current review result
  modelMap.set(updated.checkId, updated);

  // 4) 再帰的に親を辿り、必要なら更新モデルを toUpdate に収集
  // 4) Traverse the parent nodes recursively and collect the models to be updated
  const toUpdate: ReviewResultEntity[] = [];

  const recurse = (checkId: string) => {
    const node = modelMap.get(checkId);
    if (!node) return;
    const childIds = childrenMap.get(checkId);
    if (!childIds || childIds.length === 0) return;

    const childModels = childIds.map((cid) => modelMap.get(cid)!);
    // Are all child models completed?
    if (childModels.every((c) => c.status === REVIEW_RESULT_STATUS.COMPLETED)) {
      // Are all child models pass?
      const allPass = childModels.every((c) => c.result === REVIEW_RESULT.PASS);

      // Update the parent node
      node.status = REVIEW_RESULT_STATUS.COMPLETED;
      node.result = allPass ? REVIEW_RESULT.PASS : REVIEW_RESULT.FAIL;
      node.confidenceScore = calculateMinimumConfidence(childModels);
      node.explanation = generateParentExplanation(childModels, allPass);
      node.extractedText = [];

      toUpdate.push(node);

      // Recursively check the parent node
      const nextPid = node.checkList.parentId;
      if (nextPid) {
        recurse(nextPid);
      }
    }
  };

  // 5) 最初は「更新されたノードの親」からスタート
  const startParent = updated.checkList.parentId;
  if (startParent) {
    recurse(startParent);
  }

  // 6) 変更があれば一括更新
  if (toUpdate.length > 0) {
    await reviewResultRepo.bulkUpdateResults({
      results: toUpdate,
    });
  }
};

/** 子アイテムの confidenceScore の最小値を取得 */
const calculateMinimumConfidence = (children: ReviewResultDetail[]): number => {
  if (children.length === 0) return 0;
  return Math.min(...children.map((c) => c.confidenceScore ?? 0));
};

/** 子アイテムの結果から、親の説明文を生成 */
const generateParentExplanation = (
  children: ReviewResultDetail[],
  allPass: boolean
): string => {
  if (allPass) {
    return "すべての子項目がパスしています。";
  } else {
    const failed = children
      .filter((c) => c.result === REVIEW_RESULT.FAIL)
      .map((c) => c.checkList.name || "不明な項目")
      .join("、");
    return `以下の子項目が不適合です: ${failed}`;
  }
};
