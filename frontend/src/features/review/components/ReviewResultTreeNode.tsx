/**
 * 審査結果の階層構造のノードコンポーネント
 * 子要素を動的に読み込む機能を持つ
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ReviewResultDetailModel, REVIEW_FILE_TYPE } from "../types";
import ReviewResultItem from "./ReviewResultItem";
import {
  useReviewResultItems,
  FilterType,
} from "../hooks/useReviewResultQueries";
import Spinner from "../../../components/Spinner";

interface ReviewResultTreeNodeProps {
  jobId: string;
  item: ReviewResultDetailModel;
  level: number;
  confidenceThreshold: number;
  maxDepth?: number;
  autoExpand?: boolean;
  filter: FilterType;
  documents: Array<{
    id: string;
    filename: string;
    s3Path: string;
    fileType: REVIEW_FILE_TYPE;
  }>;
}

export default function ReviewResultTreeNode({
  jobId,
  item,
  level,
  confidenceThreshold,
  maxDepth = 2,
  autoExpand = false,
  filter,
  documents,
}: ReviewResultTreeNodeProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(level < maxDepth || autoExpand);

  // 子項目を取得（レベルが最大深度未満の場合は自動的に、それ以外は展開時に）
  const shouldLoadChildren =
    item.hasChildren && (level < maxDepth || isExpanded);

  const {
    items: childItems,
    isLoading: isLoadingChildren,
    error: errorChildren,
  } = useReviewResultItems(
    jobId || null,
    shouldLoadChildren ? item.checkId : undefined,
    filter
  );

  // 展開/折りたたみの切り替え
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div>
      <ReviewResultItem
        result={{
          ...item,
          children: [], // ReviewResultItemコンポーネントの型との互換性のため
        }}
        hasChildren={item.hasChildren}
        isExpanded={isExpanded}
        onToggleExpand={toggleExpand}
        confidenceThreshold={confidenceThreshold}
        isLoadingChildren={shouldLoadChildren && isLoadingChildren}
        documents={documents}
      />

      {/* 子項目を表示（展開時のみ）。
          親の開閉ボタンの下から縦線を引き、その内側に子を並べて、
          どの親の配下かを見分けやすくする。入れ子にするので階層ごとに深くなる */}
      {isExpanded && item.hasChildren && (
        <div className="ml-6 mt-2 space-y-2 border-l-2 border-gray pl-4">
          {isLoadingChildren ? (
            <div className="flex justify-center py-4">
              <Spinner size="md" />
            </div>
          ) : errorChildren ? (
            <div className="text-red-500 py-2">
              {t("review.childItemsLoadError")}
            </div>
          ) : childItems.length > 0 ? (
            childItems.map((childItem) => (
              <ReviewResultTreeNode
                key={childItem.id}
                jobId={jobId}
                item={childItem}
                level={level + 1}
                confidenceThreshold={confidenceThreshold}
                maxDepth={maxDepth}
                filter={filter}
                documents={documents}
              />
            ))
          ) : (
            <div className="text-gray-500 py-2">
              {filter !== "all"
                ? t("review.noChildItemsForFilter")
                : t("review.noChildItems")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
