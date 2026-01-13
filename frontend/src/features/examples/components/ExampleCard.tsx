import { useTranslation } from "react-i18next";
import { Example } from "../types";
import ThumbnailGrid from "./ThumbnailGrid";
import { HiExternalLink } from "react-icons/hi";
import HelpIcon from "../../../components/HelpIcon";

interface ExampleCardProps {
  example: Example;
}

/**
 * サンプルユースケースのカードコンポーネント
 * ファイル一覧を展開/折りたたみできます
 */
export default function ExampleCard({ example }: ExampleCardProps) {
  const { t } = useTranslation();

  const fileCount = example.files.length;
  const setupTypes = example.setupTypes || [];
  const hasSetup = setupTypes.length > 0;

  return (
    <div className="bg-white dark:bg-aws-squid-ink-dark rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
      {/* タイトルとタグ */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-aws-font-color-light dark:text-aws-font-color-white-dark">
            {example.name}
          </h3>
          {hasSetup && (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                <span>⚙️</span>
                <span>{t("examples.setupRequired")}</span>
                {example.githubUrl && (
                  <a
                    href={example.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-600 dark:text-orange-400 hover:opacity-70 transition-opacity"
                  >
                    <HiExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </span>
              <HelpIcon content={t("examples.setupTooltip")} position="top" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {example.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-aws-paper-light dark:bg-aws-paper-dark text-aws-font-color-light dark:text-aws-font-color-dark">
              {t(`examples.tag${tag.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("")}`)}
            </span>
          ))}
        </div>
      </div>

      {/* 説明 */}
      <p className="text-sm text-aws-font-color-gray mb-4">
        {example.description}
      </p>

      {/* サムネイルグリッド */}
      <ThumbnailGrid files={example.files} />

      {/* ファイル数の表示 */}
      <div className="flex items-center gap-3 mt-3 text-sm text-aws-font-color-gray">
        <span className="flex items-center gap-1">
          📄 {t("examples.fileCount", { count: fileCount })}
        </span>
      </div>
    </div>
  );
}
