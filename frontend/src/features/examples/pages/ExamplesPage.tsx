import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExampleTag } from "../types";
import { useExamples } from "../hooks/useExamples";
import TagFilter from "../components/TagFilter";
import ExampleCard from "../components/ExampleCard";

/**
 * サンプルユースケース一覧ページ
 * タグでフィルタリングしてサンプルを閲覧できます
 */
export default function ExamplesPage() {
  const { t, i18n } = useTranslation();
  const [selectedTags, setSelectedTags] = useState<ExampleTag[]>([]);

  const currentLanguage = (i18n.language.startsWith("ja") ? "ja" : "en") as "en" | "ja";
  const examples = useExamples(currentLanguage, selectedTags);

  const handleTagToggle = (tag: ExampleTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleClearAll = () => {
    setSelectedTags([]);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* ヘッダー */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-aws-font-color-light dark:text-aws-font-color-dark mb-2">
          {t("examples.title")}
        </h1>
        <p className="text-aws-font-color-gray">
          {t("examples.description")}
        </p>
      </div>

      {/* タグフィルター */}
      <TagFilter
        selectedTags={selectedTags}
        onTagToggle={handleTagToggle}
        onClearAll={handleClearAll}
      />

      {/* サンプル一覧 */}
      {examples.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {examples.map((example) => (
            <ExampleCard key={example.id} example={example} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-aws-font-color-gray text-lg">
            {t("examples.emptyState")}
          </p>
        </div>
      )}
    </div>
  );
}
