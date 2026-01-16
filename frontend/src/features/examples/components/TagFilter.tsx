import { useTranslation } from "react-i18next";
import { ExampleTag } from "../types";
import Button from "../../../components/Button";

interface TagFilterProps {
  selectedTags: ExampleTag[];
  onTagToggle: (tag: ExampleTag) => void;
  onClearAll: () => void;
}

/**
 * サンプルのタグフィルターコンポーネント
 * 複数のタグを選択してサンプルをフィルタリングできます
 */
export default function TagFilter({
  selectedTags,
  onTagToggle,
  onClearAll,
}: TagFilterProps) {
  const { t } = useTranslation();

  const tags: { value: ExampleTag; icon: string }[] = [
    { value: "real-estate", icon: "🏢" },
    { value: "it-department", icon: "💼" },
    { value: "manufacturing", icon: "🏭" },
    { value: "sustainability", icon: "🌱" },
    { value: "corporate-governance", icon: "📋" },
    { value: "healthcare", icon: "💊" },
  ];

  return (
    <div className="mb-6">
      <span className="text-sm font-medium text-aws-font-color-light dark:text-aws-font-color-dark mb-3 block">
        {t("examples.filterByTags")}
      </span>
      <div className="flex flex-wrap gap-2">
        {tags.map(({ value, icon }) => {
          const isSelected = selectedTags.includes(value);
          return (
            <button
              key={value}
              onClick={() => onTagToggle(value)}
              className={`
                inline-flex items-center gap-1.5 px-4 py-2 rounded-full
                text-sm font-medium transition-all cursor-pointer border-2
                ${
                  isSelected
                    ? "bg-aws-sea-blue-light dark:bg-aws-sea-blue-dark text-aws-font-color-white-light shadow-md border-aws-sea-blue-light dark:border-aws-sea-blue-dark"
                    : "bg-aws-paper-light dark:bg-aws-paper-dark text-aws-font-color-light dark:text-aws-font-color-dark hover:bg-light-gray dark:hover:bg-aws-squid-ink-dark border-light-gray dark:border-aws-ui-color-dark hover:border-aws-sea-blue-light dark:hover:border-aws-sea-blue-dark"
                }
              `}>
              <span>{icon}</span>
              <span>{t(`examples.tag${value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("")}`)}</span>
            </button>
          );
        })}
      </div>
      <div
        className={`mt-3 transition-all duration-300 ${
          selectedTags.length > 0
            ? "opacity-100 max-h-10"
            : "opacity-0 max-h-0 pointer-events-none"
        }`}>
        <Button variant="text" size="sm" onClick={onClearAll}>
          {t("examples.clearFilters")}
        </Button>
      </div>
    </div>
  );
}
