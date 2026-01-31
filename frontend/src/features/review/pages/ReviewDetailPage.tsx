import { useParams, useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import { HiClipboardCopy, HiCheck } from "react-icons/hi";
import ReviewResultTree from "../components/ReviewResultTree";
import ReviewResultFilter from "../components/ReviewResultFilter";
import { FilterType } from "../hooks/useReviewResultQueries";
import { useReviewJobDetail } from "../hooks/useReviewJobQueries";
import { ErrorAlert } from "../../../components/ErrorAlert";
import Slider from "../../../components/Slider";
import { DetailSkeleton } from "../../../components/Skeleton";
import Spinner from "../../../components/Spinner";
import { REVIEW_JOB_STATUS } from "../types";
import Breadcrumb from "../../../components/Breadcrumb";
import TotalReviewCostSummary from "../components/TotalReviewCostSummary";

export default function ReviewDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Start with showing fail items
  const [filter, setFilter] = useState<FilterType>("fail");
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.7);
  const [copied, setCopied] = useState(false);

  // Get review job details
  const {
    job,
    isLoading: isLoadingJob,
    error: jobError,
    refetch: refetchJob,
  } = useReviewJobDetail(id || null);

  // When filter state changes
  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
  };

  // Copy next action to clipboard
  const handleCopyNextAction = () => {
    if (job?.nextAction) {
      navigator.clipboard.writeText(job.nextAction);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Loading state
  if (isLoadingJob) {
    return <DetailSkeleton lines={8} />;
  }

  // Error state
  if (jobError) {
    return (
      <div className="mt-4">
        <ErrorAlert
          error={jobError}
          title={t("review.loadError")}
          message={t("review.loadErrorMessage")}
          retry={() => {
            refetchJob();
          }}
        />
        <div className="mt-4">
          <Breadcrumb to="/review" label={t("review.backToList")} />
        </div>
      </div>
    );
  }

  // If job not found
  if (!job) {
    return (
      <div className="mt-4">
        <ErrorAlert
          error={t("review.jobNotFound")}
          title={t("common.error")}
          message={t("review.jobNotFound")}
          retry={() => refetchJob()}
        />
        <div className="mt-4">
          <Breadcrumb to="/review" label={t("review.backToList")} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Breadcrumb to="/review" label={t("review.backToList")} />
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-aws-squid-ink-light">
              {job.name}
            </h1>
          </div>
          <div className="mt-3 flex items-center justify-between">
            {/* 合計料金表示 */}
            {job.totalCost && (
              <TotalReviewCostSummary
                formattedTotalCost={`$${job.totalCost.toFixed(4)}`}
                summary={{
                  totalInputTokens: job.totalInputTokens || 0,
                  totalOutputTokens: job.totalOutputTokens || 0,
                  itemCount: job.totalCost > 0 ? 1 : 0,
                }}
              />
            )}
          </div>
          <p className="mt-3 text-aws-font-color-gray">
            {t("review.documents")}:{" "}
            {job.documents.length > 0
              ? job.documents[0].filename
              : t("review.noDocuments")}
            {job.documents.length > 1
              ? t("review.otherDocuments", { count: job.documents.length - 1 })
              : ""}
          </p>
          <p className="text-aws-font-color-gray">
            {t("review.checklist")}: {job.checkList.name}
          </p>
          <p className="text-aws-font-color-gray">
            {t("review.status")}:&nbsp;
            <span
              className={`font-medium ${
                job.status === REVIEW_JOB_STATUS.COMPLETED
                  ? "text-green-600"
                  : job.status === REVIEW_JOB_STATUS.FAILED
                    ? "text-red-600"
                    : "text-yellow-600"
              }`}>
              {t(`status.${job.status}`)}
            </span>
          </p>
          <p className="text-aws-font-color-gray">
            {t("review.createdAt")}: {new Date(job.createdAt).toLocaleString()}
          </p>
          {job.completedAt && (
            <p className="text-aws-font-color-gray">
              {t("review.completedAt", "Completed At")}:{" "}
              {new Date(job.completedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Error details */}
      {job.hasError && job.errorDetail && (
        <div className="mb-6">
          <ErrorAlert
            error={job.errorDetail}
            title={t("common.processingError")}
            message={job.errorDetail}
          />
        </div>
      )}

      {/* Review results */}
      <div className="rounded-lg border border-light-gray bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-medium text-aws-squid-ink-light">
            {t("review.results")}
          </h2>
          <div className="w-64">
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={confidenceThreshold}
              onChange={setConfidenceThreshold}
              label={t("review.confidenceThreshold")}
            />
          </div>
        </div>

        {/* Filtering */}
        <ReviewResultFilter filter={filter} onChange={handleFilterChange} />

        {/* Tree view */}
        <ReviewResultTree
          jobId={id!}
          confidenceThreshold={confidenceThreshold}
          maxDepth={2}
          filter={filter}
        />
      </div>

      {/* Next Action Section */}
      {job.status === REVIEW_JOB_STATUS.COMPLETED && (
        <div className="mt-6 rounded-lg border border-light-gray bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-medium text-aws-squid-ink-light">
              {t("review.nextAction.title")}
            </h2>
            {job.nextActionStatus === "completed" && job.nextAction && (
              <button
                onClick={handleCopyNextAction}
                className="flex items-center gap-1 rounded px-2 py-1 text-sm text-aws-font-color-gray hover:bg-gray-100"
                title={t("review.nextAction.copy")}>
                {copied ? (
                  <HiCheck className="text-green-500" />
                ) : (
                  <HiClipboardCopy />
                )}
                <span>
                  {copied
                    ? t("review.nextAction.copied")
                    : t("review.nextAction.copy")}
                </span>
              </button>
            )}
          </div>
          {job.nextActionStatus === "completed" && job.nextAction ? (
            <div className="prose max-w-none">
              <ReactMarkdown>{job.nextAction}</ReactMarkdown>
            </div>
          ) : job.nextActionStatus === "processing" ? (
            <div className="flex items-center gap-2 text-aws-font-color-gray">
              <Spinner size="sm" />
              <span>{t("review.nextAction.processing")}</span>
            </div>
          ) : job.nextActionStatus === "skipped" ? (
            <p className="text-aws-font-color-gray">
              {t("review.nextAction.skipped")}
            </p>
          ) : job.nextActionStatus === "failed" ? (
            <p className="text-red-500">{t("review.nextAction.failed")}</p>
          ) : (
            <p className="text-aws-font-color-gray">
              {t("review.nextAction.skipped")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
