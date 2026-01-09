import { useMemo } from "react";
import { Example, ExampleTag } from "../types";
import examplesMetadata from "../data/examples-metadata.json";

/**
 * サンプルデータの取得とフィルタリングを行うカスタムフック
 * 選択されたタグと言語に基づいてサンプルをフィルタリングします
 */
export function useExamples(
  language: "en" | "ja",
  selectedTags: ExampleTag[]
) {
  const examples = useMemo(() => {
    // 言語に基づいてサンプルを取得
    const languageExamples = examplesMetadata[language] as Example[];

    // タグが選択されていない場合は全てを返す
    if (selectedTags.length === 0) {
      return languageExamples;
    }

    // 選択されたタグのいずれかを持つサンプルをフィルタリング (OR条件)
    return languageExamples.filter((example) =>
      example.tags.some((tag) => selectedTags.includes(tag))
    );
  }, [language, selectedTags]);

  return examples;
}
