/**
 * 重要度での絞り込み。チェックリスト画面と審査結果画面で使う。
 * 子を持つ項目は、配下を開けるように絞り込みに関係なく表示される
 */
import { useTranslation } from "react-i18next";
import SegmentedControl from "../../../components/SegmentedControl";
import { ImportanceFilterValue } from "../types";
import {
  IMPORTANCE_ICONS,
  IMPORTANCE_LABEL_KEYS,
  IMPORTANCE_LEVELS,
} from "../importance";

interface ImportanceFilterProps {
  value: ImportanceFilterValue;
  onChange: (value: ImportanceFilterValue) => void;
  /** 同じ画面にほかのセグメントコントロールがあっても区別できる名前 */
  name: string;
  className?: string;
}

export default function ImportanceFilter({
  value,
  onChange,
  name,
  className = "",
}: ImportanceFilterProps) {
  const { t } = useTranslation();

  const options = [
    { value: "all", label: t("checklist.importanceAll") },
    ...IMPORTANCE_LEVELS.map((level) => {
      const Icon = IMPORTANCE_ICONS[level];
      return {
        value: level,
        label: t(IMPORTANCE_LABEL_KEYS[level]),
        icon: <Icon className="h-4 w-4" aria-hidden="true" />,
      };
    }),
  ];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-aws-font-color-gray">
        {t("checklist.importance")}
      </span>
      <SegmentedControl
        options={options}
        value={value}
        onChange={(next) => onChange(next as ImportanceFilterValue)}
        name={name}
      />
    </div>
  );
}
