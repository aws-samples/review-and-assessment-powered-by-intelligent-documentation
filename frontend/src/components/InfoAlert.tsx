import React from "react";
import { useTranslation } from "react-i18next";
import {
  HiInformationCircle,
  HiCheck,
  HiX,
  HiExclamation,
} from "react-icons/hi";
import Button from "./Button";

interface InfoAlertProps {
  // メッセージ内容（文字列またはHTML）
  message: string | React.ReactNode;
  // HTMLとして解釈するかどうか
  dangerouslySetInnerHTML?: boolean;
  // タイトル（オプション）
  title?: string;
  // アクションボタン用のパラメータ（オプション）
  actionLabel?: string;
  onActionClick?: () => void;
  // スタイルバリアント（情報、成功、警告）
  variant?: "info" | "success" | "warning";
}

export function InfoAlert({
  message,
  title,
  actionLabel,
  onActionClick,
  variant = "info",
  dangerouslySetInnerHTML = false,
}: InfoAlertProps) {
  const { t } = useTranslation();

  // トーストのスタイル - 白背景に左側のカラーバー
  const alertStyles = {
    success: "bg-white text-aws-squid-ink-light border-l-4 border-aws-lab",
    warning: "bg-white text-aws-squid-ink-light border-l-4 border-yellow",
    info: "bg-white text-aws-squid-ink-light border-l-4 border-aws-sea-blue-light",
  };

  // アイコンの色
  const iconColors = {
    success: "text-aws-lab",
    warning: "text-yellow",
    info: "text-aws-sea-blue-light",
  };

  // アイコン
  const icons = {
    success: <HiCheck className="h-6 w-6" />,
    warning: <HiExclamation className="h-6 w-6" />,
    info: <HiInformationCircle className="h-6 w-6" />,
  };
  const defaultTitle =
    variant === "success"
      ? t("common.success")
      : variant === "warning"
        ? t("common.warning")
        : t("common.info");

  // タイトルがない場合はデフォルトのタイトルを使用
  const displayTitle = title || defaultTitle;

  return (
    <div
      className={`rounded-lg px-6 py-4 shadow-md ${alertStyles[variant]}`}
      role="alert">
      <div className="flex items-center">
        <div className={`mr-3 flex-shrink-0 ${iconColors[variant]}`}>
          {icons[variant]}
        </div>
        <strong className="font-medium whitespace-nowrap">{displayTitle}: </strong>
        <span className="ml-2">
          {dangerouslySetInnerHTML ? (
            <div dangerouslySetInnerHTML={{ __html: message as string }} />
          ) : (
            message
          )}
        </span>
        {actionLabel && onActionClick && (
          <Button
            onClick={onActionClick}
            variant="text"
            size="sm"
            className={`ml-2 ${iconColors[variant]} hover:underline`}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export default InfoAlert;
