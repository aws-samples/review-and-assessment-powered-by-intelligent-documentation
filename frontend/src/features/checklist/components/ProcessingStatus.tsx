/**
 * 処理ステータス表示コンポーネント
 */

import { useEffect } from "react";
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
const getStatusInfo = (status: CHECK_LIST_STATUS) => {
  switch (status) {
    case CHECK_LIST_STATUS.PENDING:
      return {
        label: "待機中",
        bgColor: "bg-yellow-100",
        textColor: "text-yellow-800",
        icon: <HiClock className="mr-1" />,
      };
    case CHECK_LIST_STATUS.PROCESSING:
      return {
        label: "処理中",
        bgColor: "bg-blue-100",
        textColor: "text-blue-800",
        icon: <HiRefresh className="mr-1" />,
      };
    case CHECK_LIST_STATUS.DETECTING:
      return {
        label: "曖昧検知中",
        bgColor: "bg-purple-100",
        textColor: "text-purple-800",
        icon: <HiRefresh className="mr-1 animate-spin" />,
      };
    case CHECK_LIST_STATUS.COMPLETED:
      return {
        label: "完了",
        bgColor: "bg-green-100",
        textColor: "text-green-800",
        icon: <HiCheck className="mr-1" />,
      };
    case CHECK_LIST_STATUS.FAILED:
      return {
        label: "失敗",
        bgColor: "bg-red-100",
        textColor: "text-red-800",
        icon: <HiX className="mr-1" />,
      };
    default:
      return {
        label: "不明",
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
  // すべてのドキュメントが完了または失敗したかチェック
  useEffect(() => {
    if (documents.length === 0) return;

    const allCompleted = documents.every(
      (doc) => doc.status === CHECK_LIST_STATUS.COMPLETED || doc.status === CHECK_LIST_STATUS.FAILED
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
      <h3 className="text-lg font-medium mb-3">処理ステータス</h3>

      <div className="space-y-3">
        {documents.map((document) => {
          const statusInfo = getStatusInfo(document.status);

          return (
            <div
              key={document.documentId}
              className="p-3 bg-gray-50 rounded flex items-center justify-between"
            >
              <div className="flex items-center">
                <span className="text-sm font-medium">{document.filename}</span>
              </div>

              <div
                className={`px-3 py-1 rounded-full ${statusInfo.bgColor} ${statusInfo.textColor} text-xs flex items-center`}
              >
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
