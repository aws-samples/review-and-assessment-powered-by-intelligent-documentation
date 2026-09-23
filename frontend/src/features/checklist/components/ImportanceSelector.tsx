/**
 * チェック項目の重要度を選ぶ。1回のクリックで変えられるよう、3つのボタンを並べる。
 * 重要度は判定に使わないので、審査ジョブのあるチェックリストでも変更できる
 */
import { useTranslation } from "react-i18next";
import { CHECK_ITEM_IMPORTANCE } from "../types";
import { useUpdateCheckListItemImportance } from "../hooks/useCheckListItemMutations";
import { useToast } from "../../../contexts/ToastContext";
import {
  IMPORTANCE_ICONS,
  IMPORTANCE_LABEL_KEYS,
  IMPORTANCE_LEVELS,
} from "../importance";

interface ImportanceSelectorProps {
  setId: string;
  itemId: string;
  importance?: CHECK_ITEM_IMPORTANCE;
}

export default function ImportanceSelector({
  setId,
  itemId,
  importance = CHECK_ITEM_IMPORTANCE.MEDIUM,
}: ImportanceSelectorProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { updateCheckListItemImportance, status } =
    useUpdateCheckListItemImportance(setId);
  const isUpdating = status === "loading";

  const handleSelect = async (level: CHECK_ITEM_IMPORTANCE) => {
    if (level === importance || isUpdating) {
      return;
    }
    try {
      await updateCheckListItemImportance(itemId, level);
    } catch {
      addToast(t("checklist.importanceUpdateError"), "error");
    }
  };

  return (
    <div
      role="group"
      aria-label={t("checklist.importance")}
      className="flex items-center overflow-hidden rounded border border-light-gray">
      {IMPORTANCE_LEVELS.map((level) => {
        const Icon = IMPORTANCE_ICONS[level];
        const isSelected = level === importance;
        return (
          <button
            key={level}
            type="button"
            aria-pressed={isSelected}
            title={`${t("checklist.importance")}: ${t(IMPORTANCE_LABEL_KEYS[level])}`}
            disabled={isUpdating}
            onClick={(e) => {
              e.stopPropagation();
              handleSelect(level);
            }}
            className={`flex items-center gap-0.5 px-2 py-0.5 text-xs transition-colors disabled:cursor-wait ${
              isSelected
                ? "bg-aws-sea-blue-light text-aws-font-color-white-light"
                : "bg-white text-aws-font-color-gray hover:bg-aws-paper-light"
            }`}>
            <Icon className="h-3 w-3" aria-hidden="true" />
            {t(IMPORTANCE_LABEL_KEYS[level])}
          </button>
        );
      })}
    </div>
  );
}
