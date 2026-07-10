import React from "react";
import { useNavigate } from "react-router-dom";
import { useAlert } from "../../../hooks/useAlert";
import { useTranslation } from "react-i18next";
import { HiEye, HiTrash, HiLockClosed, HiDuplicate } from "react-icons/hi";
import { CHECK_LIST_STATUS, CheckListSetSummary } from "../types";
import Table, { TableColumn, TableAction } from "../../../components/Table";
import StatusBadge from "../../../components/StatusBadge";

type CheckListSetListProps = {
  checkListSets: {
    id: string;
    name: string;
    description: string;
    processingStatus: CHECK_LIST_STATUS;
    isEditable: boolean;
    createdAt: string;
  }[];
  isLoading: boolean;
  error: string | null;
  onDelete: (id: string, name: string) => Promise<void>;
  onDuplicate: (id: string, name: string) => void;
};

/**
 * チェックリストセット一覧コンポーネント
 */
export default function CheckListSetList({
  checkListSets,
  isLoading,
  error,
  onDelete,
  onDuplicate,
}: CheckListSetListProps) {
  const { t } = useTranslation();

  const navigate = useNavigate();

  // Handle row click to navigate to details page
  const handleRowClick = (item: CheckListSetListProps["checkListSets"][0]) => {
    navigate(`/checklist/${item.id}`);
  };

  const { showConfirm, showError, AlertModal } = useAlert();

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

  // チェックリストセットの削除処理
  const handleDelete = (
    item: CheckListSetListProps["checkListSets"][0],
    e: React.MouseEvent
  ) => {
    // 編集不可の場合は削除できない
    if (item.isEditable === false) {
      showError(t("checklist.notEditable"));
      return;
    }

    showConfirm(t("checklist.deleteConfirmation", { name: item.name }), {
      title: t("common.confirm"),
      confirmButtonText: t("common.delete"),
      onConfirm: async () => {
        try {
          // 削除ロジックは親コンポーネントに委譲
          await onDelete(item.id, item.name);
        } catch (error) {
          console.error("削除に失敗しました", error);
          showError(t("checklist.deleteError", { name: item.name }));
        }
      },
    });
  };

  // Define columns
  const columns: TableColumn<CheckListSetSummary>[] = [
    {
      key: "name",
      header: t("checklist.name"),
      render: (item) => (
        <div className="flex items-center">
          <div className="text-sm font-medium text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
            {item.name}
          </div>
          {/* 編集不可の場合に鍵アイコンを表示 */}
          {item.isEditable === false && (
            <div className="text-gray-500 ml-2">
              <HiLockClosed
                className="h-5 w-5"
                title={t("checklist.notEditable")}
              />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "documents",
      header: t("review.documents"),
      render: (item) => (
        <div className="text-sm text-aws-font-color-gray">
          {item.documents && item.documents.length > 0
            ? `${item.documents[0].filename}${
                item.documents.length > 1
                  ? ` (${t("review.otherDocuments", {
                      count: item.documents.length - 1,
                    })})`
                  : ""
              }`
            : t("review.noDocuments")}
        </div>
      ),
    },
    {
      key: "description",
      header: t("checklist.description"),
      render: (item) => (
        <div
          className="max-w-xs truncate text-sm text-aws-font-color-gray"
          title={item.description}>
          {item.description}
        </div>
      ),
    },
    {
      key: "processingStatus",
      header: t("checklist.status"),
      render: (item) => (
        <div className="flex items-center">
          <StatusBadge status={item.processingStatus} />
        </div>
      ),
    },
    {
      key: "createdAt",
      header: t("common.createdAt"),
      render: (item) => (
        <div className="text-sm text-aws-font-color-gray">
          {formatDate(item.createdAt)}
        </div>
      ),
    },
  ];

  // Define actions
  const actions: TableAction<CheckListSetSummary>[] = [
    {
      icon: <HiEye className="mr-1 h-4 w-4" />,
      label: t("common.details"),
      onClick: (item) => {
        navigate(`/checklist/${item.id}`);
      },
      variant: "primary",
      outline: true,
      className: "transition-all duration-200",
    },
    {
      icon: <HiDuplicate className="mr-1 h-4 w-4" />,
      label: t("common.duplicate"),
      onClick: (item) => onDuplicate(item.id, item.name),
      variant: "secondary",
      outline: true,
      className: "transition-all duration-200",
    },
    {
      icon: <HiTrash className="mr-1 h-4 w-4" />,
      label: t("common.delete"),
      onClick: handleDelete,
      disabled: (item) => !item.isEditable,
      variant: "danger",
      outline: true,
      className: "transition-all duration-200",
    },
  ];

  return (
    <>
      <Table
        items={checkListSets}
        columns={columns}
        actions={actions}
        isLoading={isLoading}
        error={error}
        emptyMessage={t("checklist.noChecklists")}
        keyExtractor={(item) => item.id}
        onRowClick={handleRowClick}
        rowClickable={true}
      />
      <AlertModal />
    </>
  );
}
