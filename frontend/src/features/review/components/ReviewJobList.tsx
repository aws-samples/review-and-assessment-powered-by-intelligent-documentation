import React from "react";
import { useTranslation } from "react-i18next";
import { ReviewJobSummary, REVIEW_JOB_STATUS } from "../types";
import { HiEye, HiTrash } from "react-icons/hi";
import Table, { TableColumn, TableAction } from "../../../components/Table";
import StatusBadge from "../../../components/StatusBadge";

interface ReviewJobListProps {
  jobs: ReviewJobSummary[];
  onJobClick?: (job: ReviewJobSummary) => void;
  revalidate?: () => void;
  isLoading?: boolean;
}

export const ReviewJobList: React.FC<ReviewJobListProps> = ({
  jobs,
  onJobClick,
  revalidate,
  isLoading,
}) => {
  const { t } = useTranslation();

  const handleDelete = async (job: ReviewJobSummary, e: React.MouseEvent) => {
    e.stopPropagation();

    if (confirm(t("review.deleteConfirmation"))) {
      try {
        // This would use the deleteReviewJob function from useDeleteReviewJob hook
        // Since we're refactoring the component, assuming that hook will be used by the parent
        // and passed down as a prop in a future update
        await fetch(`/api/review-jobs/${job.id}`, {
          method: "DELETE",
        });

        // 削除後にデータを再取得
        if (revalidate) {
          revalidate();
        }
      } catch (error) {
        alert(t("review.deleteError"));
        console.error(error);
      }
    }
  };

  // 日付のフォーマット
  const formatDate = (dateString: string | Date) => {
    if (!dateString) return t("date.noDate");

    try {
      const date =
        typeof dateString === "string" ? new Date(dateString) : dateString;
      if (isNaN(date.getTime())) {
        return t("date.invalidDate");
      }

      return new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch (error) {
      console.error("Date formatting error:", error, dateString);
      return t("date.dateError");
    }
  };

  // Define columns
  const columns: TableColumn<ReviewJobSummary>[] = [
    {
      key: "name",
      header: t("checklist.name"),
      render: (job) => (
        <div className="text-sm font-medium text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
          {job.name}
        </div>
      ),
    },
    {
      key: "documents",
      header: t("review.documents"),
      render: (job) => (
        <div className="text-sm text-aws-font-color-gray">
          {job.documents && job.documents.length > 0
            ? `${job.documents[0].filename}${
                job.documents.length > 1
                  ? ` (${t("review.otherDocuments", {
                      count: job.documents.length - 1,
                    })})`
                  : ""
              }`
            : t("review.noDocuments")}
        </div>
      ),
    },
    {
      key: "checkListSet",
      header: t("review.checklist"),
      render: (job) => (
        <div className="text-sm text-aws-font-color-gray">
          {job.checkListSet.name}
        </div>
      ),
    },
    {
      key: "status",
      header: t("review.status"),
      render: (job) => <StatusBadge status={job.status} />,
    },
    {
      key: "createdAt",
      header: t("review.createdAt"),
      render: (job) => (
        <div className="text-sm text-aws-font-color-gray">
          {formatDate(job.createdAt)}
        </div>
      ),
    },
  ];

  // Define actions
  const actions: TableAction<ReviewJobSummary>[] = [
    {
      icon: <HiEye className="mr-1 h-4 w-4" />,
      label: t("common.details"),
      onClick: (job, e) => {
        e.stopPropagation();
        window.location.href = `/review/${job.id}`;
      },
      className: "text-aws-font-color-blue hover:text-aws-sea-blue-light",
    },
    {
      icon: <HiTrash className="mr-1 h-4 w-4" />,
      label: t("common.delete"),
      onClick: handleDelete,
      className: "text-red hover:text-light-red",
    },
  ];

  // Handle row click to navigate to details page - same as the details button
  const handleRowClick = (job: ReviewJobSummary) => {
    window.location.href = `/review/${job.id}`;
  };

  return (
    <Table
      items={jobs}
      columns={columns}
      actions={actions}
      isLoading={isLoading}
      emptyMessage={t("review.noJobs")}
      keyExtractor={(item) => item.id}
      onRowClick={handleRowClick}
      rowClickable={true}
    />
  );
};

export default ReviewJobList;
