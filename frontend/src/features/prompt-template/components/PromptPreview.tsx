import React from "react";
import { useTranslation } from "react-i18next";
import { PromptTemplate } from "../types";
import { PROMPT_TYPE_LABELS } from "../constants";

interface PromptPreviewProps {
  template: PromptTemplate;
}

export const PromptPreview: React.FC<PromptPreviewProps> = ({ template }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">{template.name}</h3>
        <p className="text-sm text-aws-font-color-gray dark:text-aws-font-color-dark">
          {PROMPT_TYPE_LABELS[template.type]}
        </p>
        {template.description && (
          <p className="mt-2 text-sm text-aws-font-color-light dark:text-aws-font-color-dark">
            {template.description}
          </p>
        )}
      </div>

      <div className="border-t pt-4">
        <h4 className="mb-2 text-sm font-medium">
          {t("promptTemplate.promptContent")}
        </h4>
        <div className="max-h-96 overflow-auto rounded-md bg-light-gray p-4 dark:bg-dark-gray">
          <pre className="font-mono whitespace-pre-wrap text-sm">
            {template.prompt}
          </pre>
        </div>
      </div>

      <div className="pt-4 text-right">
        <p className="text-xs text-aws-font-color-gray dark:text-aws-font-color-dark">
          {t("promptTemplate.lastUpdatedLabel")}:{" "}
          {new Date(template.updatedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
};
