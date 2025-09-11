import React from "react";
import { useTranslation } from "react-i18next";
import { CHECK_LIST_STATUS } from "../features/checklist/types";
import { REVIEW_JOB_STATUS } from "../features/review/types";

// Union type of all possible status values
type StatusType = CHECK_LIST_STATUS | REVIEW_JOB_STATUS;

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
}

/**
 * Common status badge component for displaying processing statuses
 * with consistent styling across the application
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const { t } = useTranslation();

  // Common styling for all badges
  const baseClasses = "rounded-full bg-aws-paper-light px-2 py-1 text-xs";
  
  // Status-specific classes and label
  let statusClasses = "";
  let statusLabel = label;

  switch (status) {
    case CHECK_LIST_STATUS.PENDING:
    case REVIEW_JOB_STATUS.PENDING:
      statusClasses = "text-yellow";
      statusLabel = statusLabel || t("status.pending");
      break;
      
    case CHECK_LIST_STATUS.PROCESSING:
    case REVIEW_JOB_STATUS.PROCESSING:
      statusClasses = "text-aws-font-color-blue";
      statusLabel = statusLabel || t("status.processing");
      break;
      
    case CHECK_LIST_STATUS.DETECTING:
      statusClasses = "text-purple-600";
      statusLabel = statusLabel || t("status.detecting");
      break;
      
    case CHECK_LIST_STATUS.COMPLETED:
    case REVIEW_JOB_STATUS.COMPLETED:
      statusClasses = "text-aws-lab";
      statusLabel = statusLabel || t("status.completed");
      break;
      
    case CHECK_LIST_STATUS.FAILED:
    case REVIEW_JOB_STATUS.FAILED:
      statusClasses = "text-red";
      statusLabel = statusLabel || t("status.failed");
      break;
      
    default:
      statusClasses = "text-aws-font-color-gray";
      statusLabel = statusLabel || t("status.unknown");
      break;
  }

  return (
    <span className={`${baseClasses} ${statusClasses}`}>
      {statusLabel}
    </span>
  );
};

export default StatusBadge;
