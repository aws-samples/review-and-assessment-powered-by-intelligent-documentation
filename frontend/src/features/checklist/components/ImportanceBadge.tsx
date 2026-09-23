/**
 * チェック項目の重要度を、アイコンと文字で示す。
 * 色の違いだけに頼らないよう、段階ごとに形の違うアイコンと文字を並べる
 */
import { useTranslation } from "react-i18next";
import { CHECK_ITEM_IMPORTANCE } from "../types";
import { IMPORTANCE_ICONS, IMPORTANCE_LABEL_KEYS } from "../importance";

interface ImportanceBadgeProps {
  /** 未設定（重要度を返さない API）の場合は「中」として表示する */
  importance?: CHECK_ITEM_IMPORTANCE;
  className?: string;
}

export default function ImportanceBadge({
  importance = CHECK_ITEM_IMPORTANCE.MEDIUM,
  className = "",
}: ImportanceBadgeProps) {
  const { t } = useTranslation();
  const Icon = IMPORTANCE_ICONS[importance];

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-sm ${
        importance === CHECK_ITEM_IMPORTANCE.HIGH
          ? "font-medium text-aws-squid-ink-light"
          : "text-aws-font-color-gray"
      } ${className}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {t("checklist.importance")}: {t(IMPORTANCE_LABEL_KEYS[importance])}
    </span>
  );
}
