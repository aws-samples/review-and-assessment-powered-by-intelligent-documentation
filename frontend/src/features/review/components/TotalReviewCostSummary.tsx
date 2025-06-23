import { useTranslation } from "react-i18next";

interface TotalReviewCostSummaryProps {
  formattedTotalCost: string;
  summary: {
    totalInputTokens: number;
    totalOutputTokens: number;
    itemCount: number;
  };
}

/**
 * 審査結果全体の合計コストを表示するコンポーネント
 */
export default function TotalReviewCostSummary({
  formattedTotalCost,
  summary,
}: TotalReviewCostSummaryProps) {
  const { t } = useTranslation();

  return (
    <div className="inline-flex items-center space-x-4 rounded-lg border border-gray px-4 py-2">
      <div className="flex items-center space-x-2">
        <span className="text-sm text-aws-font-color-gray">
          {t("review.totalCost", "合計コスト")}:
        </span>
        <span className="font-semibold text-sky-600">{formattedTotalCost}</span>
      </div>
      <div className="text-xs text-aws-font-color-gray">
        {summary.totalInputTokens.toLocaleString()}
        {t("review.input", "入力")} +{" "}
        {summary.totalOutputTokens.toLocaleString()}
        {t("review.output", "出力")}
      </div>
    </div>
  );
}
