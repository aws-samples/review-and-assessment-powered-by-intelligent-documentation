import React from "react";
import { useNavigate } from "react-router-dom";
import { useAlert } from "../../../hooks/useAlert";
import { useTranslation } from "react-i18next";
import { ReviewJobSummary } from "../types";
import { HiEye, HiTrash } from "react-icons/hi";
import Table, { TableColumn, TableAction } from "../../../components/Table";
import StatusBadge from "../../../components/StatusBadge";
import { useDeleteReviewJob } from "../hooks/useReviewJobMutations";

interface ReviewJobListProps {
  jobs: ReviewJobSummary[];
  onJobClick?: (job: ReviewJobSummary) => void;
  revalidate?: () => void;
  isLoading?: boolean;
}

export const ReviewJobList: React.FC<ReviewJobListProps> = ({
  jobs,
  revalidate,
  isLoading,
}) => {
  const { t } = useTranslation();

  const navigate = useNavigate();

  const { showConfirm, showError, AlertModal } = useAlert();

  const { deleteReviewJob } = useDeleteReviewJob();

  const handleDelete = (job: ReviewJobSummary, e: React.MouseEvent) => {
    e.stopPropagation();

    showConfirm(t("review.deleteConfirmation", { name: job.name }), {
      title: t("common.confirm"),
      confirmButtonText: t("common.delete"),
      onConfirm: async () => {
        try {
          await deleteReviewJob(job.id);

          // 削除後にデータを再取得
          if (revalidate) {
            revalidate();
          }
        } catch (error) {
          showError(t("review.deleteError", { name: job.name }));
          console.error(error);
        }
      },
    });
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
        navigate(`/review/${job.id}`);
      },
      variant: "primary",
      outline: true,
      className: "transition-all duration-200",
    },
    {
      icon: <HiTrash className="mr-1 h-4 w-4" />,
      label: t("common.delete"),
      onClick: handleDelete,
      variant: "danger",
      outline: true,
      className: "transition-all duration-200",
    },
  ];

  // Handle row click to navigate to details page - same as the details button
  const handleRowClick = (job: ReviewJobSummary) => {
    navigate(`/review/${job.id}`);
  };

  return (
    <>
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
      <AlertModal />
    </>
  );
};

export default ReviewJobList;
