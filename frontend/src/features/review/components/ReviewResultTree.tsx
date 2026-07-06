/**
 * 審査結果の階層構造を表示するツリーコンポーネント
 */
import {
  useReviewResultItems,
  FilterType,
} from "../hooks/useReviewResultQueries";
import { useTranslation } from "react-i18next";
import { useReviewJobDetail } from "../hooks/useReviewJobQueries";
import ReviewResultTreeNode from "./ReviewResultTreeNode";
import { TreeSkeleton } from "../../../components/Skeleton";

interface ReviewResultTreeProps {
  jobId: string;
  confidenceThreshold: number;
  maxDepth?: number;
  filter: FilterType;
}

export default function ReviewResultTree({
  jobId,
  confidenceThreshold,
  maxDepth = 2,
  filter,
}: ReviewResultTreeProps) {
  const { t } = useTranslation();
  // ルート項目を取得（フィルタリング条件を適用）
  const {
    items: rootItems,
    isLoading: isLoadingRoot,
    error: errorRoot,
  } = useReviewResultItems(jobId || null, undefined, filter);

  // ジョブ情報を取得して、ドキュメントタイプとパスを取得
  const { job, isLoading: isLoadingJob } = useReviewJobDetail(jobId);

  if (isLoadingRoot || isLoadingJob) {
    return <TreeSkeleton nodes={3} />;
  }

  if (errorRoot) {
    return (
      <div className="text-red-500 py-10 text-center">
        {t("review.resultsLoadError")}
      </div>
    );
  }

  if (rootItems.length === 0) {
    return (
      <div className="text-gray-500 py-10 text-center">
        {filter !== "all"
          ? t("review.noResultsForFilter")
          : t("review.noResults")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rootItems.map((item) => (
        <ReviewResultTreeNode
          key={item.id}
          jobId={jobId}
          item={item}
          level={0}
          confidenceThreshold={confidenceThreshold}
          maxDepth={maxDepth}
          filter={filter}
          documents={job?.documents || []}
        />
      ))}
    </div>
  );
}
