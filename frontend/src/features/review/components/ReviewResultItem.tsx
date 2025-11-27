/**
 * Component to display individual review result items
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ReviewResultDetail,
  REVIEW_RESULT,
  REVIEW_RESULT_STATUS,
  REVIEW_FILE_TYPE,
} from "../types";
import ReviewResultOverrideModal from "./ReviewResultOverrideModal";
import Button from "../../../components/Button";
import {
  HiChevronDown,
  HiChevronRight,
  HiPencil,
  HiChevronUp,
  HiEye,
  HiEyeOff,
} from "react-icons/hi";
import Spinner from "../../../components/Spinner";
import DocumentPreview from "../../../components/DocumentPreview";
import ImagePreview from "../../../components/ImagePreview";
import ReviewItemCostBadge from "./ReviewItemCostBadge";
import { useReviewItemCost } from "../hooks/useReviewItemCost";
import ResultCard, { ResultCardVariant } from "../../../components/ResultCard";
import ExternalSourceItem from "./ExternalSourceItem";

interface ReviewResultItemProps {
  result: ReviewResultDetail;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  confidenceThreshold: number;
  isLoadingChildren?: boolean;
  documents: Array<{
    id: string;
    filename: string;
    s3Path: string;
    fileType: REVIEW_FILE_TYPE;
  }>;
}

export default function ReviewResultItem({
  result,
  hasChildren,
  isExpanded,
  onToggleExpand,
  confidenceThreshold,
  isLoadingChildren,
  documents,
}: ReviewResultItemProps) {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [visibleReferencesCount, setVisibleReferencesCount] = useState(5); // 初期表示数
  const [showDetails, setShowDetails] = useState(false); // いかなる場合も詳細を最初は隠した状態に設定
  const costInfo = useReviewItemCost(result); // コスト情報を直接取得

  // Get source references
  const sourceReferences = result.sourceReferences || [];

  // Add style if confidence is below threshold
  const isBelowThreshold =
    result.confidenceScore !== null &&
    result.confidenceScore !== undefined &&
    result.confidenceScore < confidenceThreshold;

  // Determine badge color and text based on result
  const renderStatusBadge = () => {
    if (result.status === REVIEW_RESULT_STATUS.PROCESSING) {
      return (
        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
          {t("status.processing")}
        </span>
      );
    }

    if (result.status === REVIEW_RESULT_STATUS.FAILED) {
      return (
        <span className="bg-red-100 text-red-800 rounded-full px-2 py-1 text-xs">
          {t("status.failed")}
        </span>
      );
    }

    if (result.status === REVIEW_RESULT_STATUS.PENDING) {
      return (
        <span className="bg-yellow-100 text-yellow-800 rounded-full px-2 py-1 text-xs">
          {t("status.pending")}
        </span>
      );
    }

    if (result.result === REVIEW_RESULT.PASS) {
      return (
        <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
          {t("review.pass", "Pass")}
        </span>
      );
    }

    if (result.result === REVIEW_RESULT.FAIL) {
      return (
        <span className="bg-red-100 text-red-800 rounded-full px-2 py-1 text-xs">
          {t("review.fail", "Fail")}
        </span>
      );
    }

    return (
      <span className="bg-gray-100 text-gray-800 rounded-full px-2 py-1 text-xs">
        {t("common.unknown")}
      </span>
    );
  };

  // User override badge
  const renderUserOverrideBadge = () => {
    if (result.userOverride) {
      return (
        <span className="ml-2 rounded-full bg-aws-sea-blue-light bg-opacity-20 px-2 py-1 text-xs text-aws-sea-blue-light">
          {t("review.userOverride", "User Override")}
        </span>
      );
    }
    return null;
  };

  // Display confidence score
  const renderConfidenceScore = () => {
    if (result.confidenceScore === null) return null;

    // Determine color based on confidence score
    const getScoreColor = () => {
      if (
        result.confidenceScore !== undefined &&
        result.confidenceScore >= confidenceThreshold
      )
        return "text-aws-lab";
      return "text-yellow";
    };

    return (
      <span
        className={`text-sm ${getScoreColor()} ${
          isBelowThreshold ? "font-bold" : ""
        }`}>
        {t("review.confidence", "Confidence")}:{" "}
        {result.confidenceScore !== undefined
          ? Math.round(result.confidenceScore * 100)
          : 0}
        %{isBelowThreshold && <span className="ml-1 text-yellow">⚠️</span>}
      </span>
    );
  };

  // Fallback if checkList is undefined
  if (!result.checkList) {
    return (
      <div className="rounded-md border border-light-gray bg-white p-4">
        <div className="text-red">
          {t("review.dataError", "Data Error")}:{" "}
          {t("review.noChecklistInfo", "No checklist information")} (ID:{" "}
          {result.checkId})
        </div>
        <div className="mt-2">
          <Button
            onClick={() => window.location.reload()}
            variant="secondary"
            size="sm">
            {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  // Determine card variant based on result status
  const getCardVariant = (): ResultCardVariant => {
    if (result.result === REVIEW_RESULT.PASS) return "success";
    if (result.result === REVIEW_RESULT.FAIL) return "error";
    return "default";
  };

  return (
    <>
      <ResultCard
        variant={getCardVariant()}
        emphasize={isBelowThreshold}
      >
        <div
          id={`result-item-${result.id}`}
          className="grid grid-cols-[auto_1fr_auto] gap-4">
          {/* Expand/collapse button - 1st column */}
          <div className="pt-1">
            {hasChildren && (
              <Button
                onClick={onToggleExpand}
                variant="text"
                size="sm"
                className="p-0"
                disabled={isLoadingChildren}>
                {isExpanded ? (
                  isLoadingChildren ? (
                    <Spinner size="sm" />
                  ) : (
                    <HiChevronDown className="h-5 w-5" />
                  )
                ) : (
                  <HiChevronRight className="h-5 w-5" />
                )}
              </Button>
            )}
          </div>

          {/* Item information - 2nd column */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="font-medium text-aws-squid-ink-light">
                  {result.checkList.name}
                </div>
                <div className="ml-2">
                  {renderStatusBadge()}
                  {renderUserOverrideBadge()}
                </div>
                {/* 信頼度スコアと料金を上段に表示 */}
                {!hasChildren && renderConfidenceScore() && (
                  <div className="ml-3 flex items-center space-x-2">
                    {renderConfidenceScore()}
                    {costInfo.hasCost && (
                      <ReviewItemCostBadge
                        formattedCost={costInfo.formattedCost}
                        size="sm"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* アクションボタンを上段の右側に配置 */}
              <div className="flex items-center space-x-3">
                <Button
                  onClick={() => setShowDetails(!showDetails)}
                  outline
                  size="sm"
                  className="text-aws-font-color-blue"
                  icon={
                    showDetails ? (
                      <HiEyeOff className="h-4 w-4" />
                    ) : (
                      <HiEye className="h-4 w-4" />
                    )
                  }>
                  {showDetails
                    ? t("review.hideDetails", "Hide Details")
                    : t("review.showDetails", "Show Details")}
                </Button>

                {/* 上書きボタンを同じ行に配置 */}
                {!hasChildren &&
                  result.status === REVIEW_RESULT_STATUS.COMPLETED && (
                    <Button
                      onClick={() => setIsModalOpen(true)}
                      outline
                      size="sm"
                      className="text-aws-font-color-blue"
                      icon={<HiPencil className="h-4 w-4" />}>
                      {t("review.overrideResult", "Override Result")}
                    </Button>
                  )}
              </div>
            </div>

            {/* 短い説明文を表示 */}
            {result.shortExplanation && (
              <div className="mt-1">
                <p className="text-sm text-aws-font-color-gray">
                  {result.shortExplanation}
                </p>
              </div>
            )}

            {/* 説明文と抽出テキスト */}
            {showDetails &&
              (result.explanation ||
                result.extractedText ||
                result.userComment ||
                result.checkList.description) && (
                <div className="mt-3 grid grid-cols-1 gap-3">
                  {/* 項目の説明 */}
                  {result.checkList.description && (
                    <div className="rounded border border-light-gray bg-aws-paper-light p-3 text-sm">
                      <p className="mb-1 font-medium text-aws-squid-ink-light">
                        {t("review.itemDescription", "Item Description")}:
                      </p>
                      <p className="text-aws-font-color-gray">
                        {result.checkList.description}
                      </p>
                    </div>
                  )}

                  {result.explanation && (
                    <div className="rounded border border-light-gray bg-aws-paper-light p-3 text-sm">
                      <p className="mb-1 font-medium text-aws-squid-ink-light">
                        {t("review.aiDecision", "AI Decision")}:
                      </p>
                      <p className="text-aws-font-color-gray">
                        {result.explanation}
                      </p>
                    </div>
                  )}

                  {/* Display extracted text */}
                  {result.extractedText && result.extractedText.length > 0 && (
                    <div className="rounded border border-light-gray bg-aws-paper-light p-3 text-sm">
                      <p className="mb-1 font-medium text-aws-squid-ink-light">
                        {t("review.sourceText", "Source Text")}:
                      </p>
                      <div className="space-y-2">
                        {result.extractedText.map((citation, index) => (
                          <div
                            key={index}
                            className="rounded border border-light-gray bg-white p-2 text-aws-font-color-gray"
                          >
                            {citation}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Display source documents (list format) */}
                  {sourceReferences.length > 0 && (
                    <div className="mt-3 rounded border border-light-gray bg-aws-paper-light p-3 text-sm">
                      <p className="mb-1 font-medium text-aws-squid-ink-light">
                        {t("review.sourceDocuments", "Source Documents")}:
                      </p>
                      <p className="mb-2 text-sm text-aws-font-color-gray">
                        {t("review.sourceList", "Source List")} (
                        {sourceReferences.length}
                        {t("review.items", "items")})
                      </p>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                        {sourceReferences
                          .slice(0, visibleReferencesCount)
                          .map((reference: any, index: number) => {
                            const doc = documents.find(
                              (d) => d.id === reference.documentId
                            );
                            if (!doc) return null;

                            return (
                              <div
                                key={`${reference.documentId}-${
                                  reference.pageNumber || index
                                }`}
                                className="rounded border border-light-gray p-2">
                                {doc.fileType === REVIEW_FILE_TYPE.PDF ? (
                                  <DocumentPreview
                                    s3Key={doc.s3Path}
                                    filename={doc.filename}
                                    pageNumber={reference.pageNumber}
                                  />
                                ) : doc.fileType === REVIEW_FILE_TYPE.IMAGE ? (
                                  <ImagePreview
                                    s3Key={doc.s3Path}
                                    filename={doc.filename}
                                    thumbnailHeight={80} // Smaller thumbnail size
                                    boundingBox={reference.boundingBox} // Pass bounding box info
                                  />
                                ) : null}
                              </div>
                            );
                          })}
                      </div>

                      {sourceReferences.length > visibleReferencesCount && (
                        <div className="mt-2 text-center">
                          <Button
                            onClick={() =>
                              setVisibleReferencesCount((prev) =>
                                prev === sourceReferences.length
                                  ? 5
                                  : sourceReferences.length
                              )
                            }
                            variant="text"
                            size="sm"
                            icon={
                              visibleReferencesCount ===
                              sourceReferences.length ? (
                                <HiChevronUp className="h-4 w-4" />
                              ) : (
                                <HiChevronDown className="h-4 w-4" />
                              )
                            }>
                            {visibleReferencesCount === sourceReferences.length
                              ? t("review.collapse", "Collapse")
                              : t("review.showAll", "Show All")}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* External Sources - Review level */}
                  {result.externalSources &&
                    result.externalSources.length > 0 && (
                      <div className="mt-4 border-t border-light-gray pt-4">
                        <p className="mb-2 text-sm font-medium text-aws-squid-ink-light">
                          {t("review.externalSources", "External Sources")}:
                        </p>
                        <div className="space-y-2">
                          {result.externalSources.map(
                            (source, idx: number) => (
                              <ExternalSourceItem key={idx} source={source} />
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {/* User comments */}
                  {result.userComment && (
                    <div className="rounded bg-aws-sea-blue-light bg-opacity-10 p-3 text-sm">
                      <p className="mb-1 font-medium text-aws-squid-ink-light">
                        {t("review.userComment", "User Comment")}:
                      </p>
                      <p className="text-aws-font-color-gray">
                        {result.userComment}
                      </p>
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* Confidence score and override button - 3rd column */}
          <div className="flex flex-col items-end space-y-2 self-start">
            {/* 信頼度スコアは上段に移動したため、ここでは表示しない */}
          </div>
        </div>
      </ResultCard>

      {/* Override modal */}
      {isModalOpen && (
        <ReviewResultOverrideModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          result={result}
        />
      )}
    </>
  );
}
