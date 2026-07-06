/**
 * 処理ステータス表示コンポーネント
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { CHECK_LIST_STATUS } from "../types";
import {
  HiClock,
  HiRefresh,
  HiCheck,
  HiX,
  HiQuestionMarkCircle,
} from "react-icons/hi";

export interface CheckListStatusItem {
  documentId: string;
  filename: string;
  status: CHECK_LIST_STATUS;
}

interface ProcessingStatusProps {
  documents: CheckListStatusItem[];
  onAllCompleted?: () => void;
}

/**
 * ステータスに応じたラベルとスタイルを取得
 */
const getStatusInfo = (status: CHECK_LIST_STATUS, t: TFunction) => {
  switch (status) {
    case CHECK_LIST_STATUS.PENDING:
      return {
        label: t("status.pending"),
        bgColor: "bg-yellow-100",
        textColor: "text-yellow-800",
        icon: <HiClock className="mr-1" />,
      };
    case CHECK_LIST_STATUS.PROCESSING:
      return {
        label: t("status.processing"),
        bgColor: "bg-blue-100",
        textColor: "text-blue-800",
        icon: <HiRefresh className="mr-1" />,
      };
    case CHECK_LIST_STATUS.DETECTING:
      return {
        label: t("status.detecting"),
        bgColor: "bg-purple-100",
        textColor: "text-purple-800",
        icon: <HiRefresh className="mr-1 animate-spin" />,
      };
    case CHECK_LIST_STATUS.COMPLETED:
      return {
        label: t("status.completed"),
        bgColor: "bg-green-100",
        textColor: "text-green-800",
        icon: <HiCheck className="mr-1" />,
      };
    case CHECK_LIST_STATUS.FAILED:
      return {
        label: t("status.failed"),
        bgColor: "bg-red-100",
        textColor: "text-red-800",
        icon: <HiX className="mr-1" />,
      };
    default:
      return {
        label: t("status.unknown"),
        bgColor: "bg-gray-100",
        textColor: "text-gray-800",
        icon: <HiQuestionMarkCircle className="mr-1" />,
      };
  }
};

/**
 * 処理ステータス表示コンポーネント
 */
export function ProcessingStatus({
  documents,
  onAllCompleted,
}: ProcessingStatusProps) {
  const { t } = useTranslation();
  // すべてのドキュメントが完了または失敗したかチェック
  useEffect(() => {
    if (documents.length === 0) return;

    const allCompleted = documents.every(
      (doc) =>
        doc.status === CHECK_LIST_STATUS.COMPLETED ||
        doc.status === CHECK_LIST_STATUS.FAILED
    );

    if (allCompleted && onAllCompleted) {
      onAllCompleted();
    }
  }, [documents, onAllCompleted]);

  // ドキュメントがない場合
  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-lg font-medium">
        {t("checklist.processingStatus")}
      </h3>

      <div className="space-y-3">
        {documents.map((document) => {
          const statusInfo = getStatusInfo(document.status, t);

          return (
            <div
              key={document.documentId}
              className="bg-gray-50 flex items-center justify-between rounded p-3">
              <div className="flex items-center">
                <span className="text-sm font-medium">{document.filename}</span>
              </div>

              <div
                className={`rounded-full px-3 py-1 ${statusInfo.bgColor} ${statusInfo.textColor} flex items-center text-xs`}>
                {statusInfo.icon}
                <span>{statusInfo.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
