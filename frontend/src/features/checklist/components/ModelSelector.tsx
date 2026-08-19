/**
 * チェックリスト項目のモデル選択コンポーネント
 * ドロップダウンでモデル一覧を表示し、選択時に PATCH API を呼び出す
 */
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronDown, HiCheck } from "react-icons/hi";
import { useAvailableModels } from "../hooks/useCheckListItemQueries";
import { useUpdateCheckListItemModel } from "../hooks/useCheckListItemMutations";
import { formatModelLabel } from "../utils/modelLabel";

interface ModelSelectorProps {
  setId: string;
  itemId: string;
  currentModelId?: string;
  disabled?: boolean;
}

export default function ModelSelector({
  setId,
  itemId,
  currentModelId,
  disabled = false,
}: ModelSelectorProps) {
  const { t } = useTranslation();
  const { models, defaultModelId } = useAvailableModels();
  const { updateCheckListItemModel } = useUpdateCheckListItemModel(setId);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const defaultWord = t("checklist.modelDefault");
  // モデル名整形は単一の整形器 `formatModelLabel` に集約する（二重括弧解消）。
  // 既定ラベル: 明示指定なし扱いで `デフォルト: <既定 displayName>`（既定解決不可なら `デフォルト`）。
  const defaultLabel = formatModelLabel(undefined, models, defaultModelId, {
    defaultWord,
  });
  // トリガ表示: 明示指定があればその displayName、無ければ既定ラベル。
  const triggerLabel = formatModelLabel(currentModelId, models, defaultModelId, {
    defaultWord,
  });

  const handleSelect = async (modelId: string | null) => {
    setIsOpen(false);
    try {
      await updateCheckListItemModel(itemId, modelId);
    } catch {
      // エラーはフック側で管理
    }
  };

  // 外側クリックで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // モデル一覧が空の場合は非表示（フックの後に配置）
  if (models.length === 0) return null;

  const isDefault = !currentModelId;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        disabled={disabled}
        className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors ${
          disabled
            ? "text-gray-300 cursor-not-allowed"
            : "hover:bg-gray-100 text-aws-font-color-gray hover:text-aws-squid-ink-light"
        }`}
        aria-label={t("checklist.modelSelector")}
        aria-haspopup="listbox"
        aria-expanded={isOpen}>
        <span className="text-right leading-tight">{triggerLabel}</span>
        <HiChevronDown className="h-3 w-3 flex-shrink-0" />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className="border-gray-200 absolute right-0 z-50 mt-1 max-h-60 min-w-[200px] overflow-auto rounded border bg-white py-1 shadow-lg">
          {/* デフォルト（リセット）オプション */}
          <li
            role="option"
            aria-selected={isDefault}
            className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-aws-paper-light ${
              isDefault
                ? "bg-aws-sea-blue-light/10 font-medium text-aws-sea-blue-light"
                : "text-aws-squid-ink-light"
            }`}
            onClick={() => handleSelect(null)}>
            <HiCheck
              className={`h-4 w-4 flex-shrink-0 ${isDefault ? "text-aws-sea-blue-light" : "invisible"}`}
            />
            <span>{defaultLabel}</span>
          </li>

          {/* 区切り線 */}
          <li className="border-gray-200 my-1 border-t" role="separator" />

          {models.map((model) => {
            const isSelected = currentModelId === model.modelId;
            return (
              <li
                key={model.modelId}
                role="option"
                aria-selected={isSelected}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-aws-paper-light ${
                  isSelected
                    ? "bg-aws-sea-blue-light/10 font-medium text-aws-sea-blue-light"
                    : "text-aws-squid-ink-light"
                }`}
                onClick={() => handleSelect(model.modelId)}>
                <HiCheck
                  className={`h-4 w-4 flex-shrink-0 ${isSelected ? "text-aws-sea-blue-light" : "invisible"}`}
                />
                {model.displayName}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
