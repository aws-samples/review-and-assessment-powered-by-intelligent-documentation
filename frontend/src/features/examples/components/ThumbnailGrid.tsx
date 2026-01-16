import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExampleFile, FileType } from "../types";
import StaticImagePreview from "../../../components/StaticImagePreview";

interface ThumbnailGridProps {
  files: ExampleFile[];
}

/**
 * サムネイルグリッドコンポーネント
 * ファイルタイプごとにグループ化されたサムネイルを表示します
 * StaticImagePreviewコンポーネントを使用してズーム機能付きモーダルを提供
 */
export default function ThumbnailGrid({ files }: ThumbnailGridProps) {
  const { t } = useTranslation();
  const [isKnowledgeExpanded, setIsKnowledgeExpanded] = useState(false);

  // 画像があるファイルのみをフィルタリング
  const filesWithImages = files.filter((file) => file.imagePath);

  if (filesWithImages.length === 0) {
    return null; // 画像がない場合は何も表示しない
  }

  const getFileTypeLabel = (type: FileType): string => {
    switch (type) {
      case "checklist":
        return t("examples.checklistFiles");
      case "review":
        return t("examples.reviewDocuments");
      case "knowledge":
        return t("examples.knowledgeBase");
    }
  };

  const getFileTypeIcon = (type: FileType): string => {
    switch (type) {
      case "checklist":
        return "📋";
      case "review":
        return "📄";
      case "knowledge":
        return "📚";
    }
  };

  // ファイルをタイプ別にグループ化
  const filesByType = filesWithImages.reduce(
    (acc, file) => {
      if (!acc[file.type]) {
        acc[file.type] = [];
      }
      acc[file.type].push(file);
      return acc;
    },
    {} as Record<FileType, typeof filesWithImages>
  );

  return (
    <div className="mt-3 space-y-2">
      {/* チェックリストと審査用を横並び */}
      {(["checklist", "review"] as FileType[]).map((type) => {
        const typeFiles = filesByType[type];
        if (!typeFiles || typeFiles.length === 0) return null;

        return (
          <div key={type} className="inline-block mr-4">
            <h4 className="text-xs font-medium text-aws-font-color-light dark:text-aws-font-color-dark mb-1.5 flex items-center gap-1">
              <span className="text-sm">{getFileTypeIcon(type)}</span>
              <span>
                {getFileTypeLabel(type)} ({typeFiles.length})
              </span>
            </h4>
            <div className="flex gap-2">
              {typeFiles.slice(0, 1).map((file) => (
                <StaticImagePreview
                  key={file.id}
                  imageUrl={file.imagePath!}
                  filename={file.name}
                  thumbnailHeight={80}
                  documentUrl={file.url}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* ナレッジベース（折りたたみ可能） */}
      {filesByType.knowledge && filesByType.knowledge.length > 0 && (
        <div className="mt-2">
          <h4 className="text-xs font-medium text-aws-font-color-light dark:text-aws-font-color-dark mb-1.5 flex items-center gap-1">
            <span className="text-sm">📚</span>
            <span>
              {getFileTypeLabel("knowledge")} ({filesByType.knowledge.length})
            </span>
          </h4>
          <div className="flex gap-2 flex-wrap">
            {filesByType.knowledge
              .slice(0, isKnowledgeExpanded ? undefined : 2)
              .map((file) => (
                <div key={file.id} className="w-20">
                  <StaticImagePreview
                    imageUrl={file.imagePath!}
                    filename={file.name}
                    thumbnailHeight={80}
                    documentUrl={file.url}
                  />
                </div>
              ))}
            {filesByType.knowledge.length > 2 && (
              <button
                onClick={() => setIsKnowledgeExpanded(!isKnowledgeExpanded)}
                className="flex items-center justify-center px-3 py-1 text-xs text-aws-sea-blue dark:text-aws-sea-blue-dark hover:underline"
              >
                {isKnowledgeExpanded
                  ? t("examples.showLess")
                  : t("examples.showMore", {
                      count: filesByType.knowledge.length - 2,
                    })}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
