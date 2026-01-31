import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { PromptTemplate } from "../types";
import Modal from "../../../components/Modal";
import { PromptPreview } from "./PromptPreview";
import { FiEye } from "react-icons/fi";

interface PromptTemplateSelectorProps {
  templates: PromptTemplate[];
  selectedTemplateId?: string;
  onChange: (templateId?: string) => void;
  isLoading: boolean;
}

export const PromptTemplateSelector: React.FC<PromptTemplateSelectorProps> = ({
  templates,
  selectedTemplateId,
  onChange,
  isLoading,
}) => {
  const { t } = useTranslation();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<PromptTemplate | null>(
    null
  );

  const handleSelectTemplate = (template: PromptTemplate) => {
    onChange(template.id);
  };

  const handlePreviewTemplate = (
    template: PromptTemplate,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setPreviewTemplate(template);
    setIsPreviewOpen(true);
  };

  const handleSelectDefault = () => {
    onChange(undefined);
  };

  if (isLoading) {
    return (
      <div className="h-40 w-full animate-pulse rounded-md border border-light-gray bg-light-gray shadow-sm"></div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-light-gray bg-white shadow-sm dark:bg-aws-squid-ink-dark">
      <div className="border-b border-light-gray p-4">
        <h3 className="text-lg font-medium text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
          {t("checklist.promptTemplateTitle", "Prompt Templates")}
        </h3>
        <p className="mt-1 text-sm text-aws-font-color-gray">
          {t("checklist.promptTemplateDescription")}
        </p>
      </div>

      <div className="divide-y divide-light-gray">
        {/* System Default Option */}
        <label
          className={`flex cursor-pointer items-center p-4 transition-colors ${
            !selectedTemplateId
              ? "bg-aws-sea-blue-light bg-opacity-10"
              : "hover:bg-aws-paper-light"
          }`}>
          <input
            type="radio"
            name="promptTemplate"
            checked={!selectedTemplateId}
            onChange={handleSelectDefault}
            className="h-4 w-4 text-aws-sea-blue-light focus:ring-aws-sea-blue-light"
          />
          <div className="ml-3 text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
            <span className="font-medium">
              {t("checklist.systemDefault", "System Default")}
            </span>
            <p className="mt-1 text-sm text-aws-font-color-gray">
              {t(
                "checklist.systemDefaultDescription",
                "Standard template for checklist extraction"
              )}
            </p>
          </div>
        </label>

        {/* Available Templates */}
        {templates.map((template) => (
          <div
            key={template.id}
            className={`flex items-center justify-between p-4 transition-colors ${
              selectedTemplateId === template.id
                ? "bg-aws-sea-blue-light bg-opacity-10"
                : "hover:bg-aws-paper-light"
            }`}>
            <label className="flex flex-grow cursor-pointer items-center">
              <input
                type="radio"
                name="promptTemplate"
                checked={selectedTemplateId === template.id}
                onChange={() => handleSelectTemplate(template)}
                className="h-4 w-4 text-aws-sea-blue-light focus:ring-aws-sea-blue-light"
              />
              <div className="ml-3 text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
                <span className="font-medium">{template.name}</span>
                {template.description && (
                  <p className="mt-1 text-sm text-aws-font-color-gray">
                    {template.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-aws-font-color-gray">
                  {t("checklist.lastUpdated", "Last updated")}:{" "}
                  {new Date(template.updatedAt).toLocaleString()}
                </p>
              </div>
            </label>
            <button
              onClick={(e) => handlePreviewTemplate(template, e)}
              className="ml-2 flex items-center rounded-full p-2 text-aws-font-color-blue hover:bg-aws-paper-light hover:text-aws-sea-blue-light"
              aria-label={t("checklist.previewTemplate", "Preview template")}>
              <FiEye className="h-5 w-5" />
            </button>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="p-4 text-center text-aws-font-color-gray">
            {t(
              "checklist.noTemplatesAvailable",
              "No custom templates available"
            )}
          </div>
        )}
      </div>

      {isPreviewOpen && previewTemplate && (
        <Modal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          title={t("checklist.promptPreview", "Prompt Preview")}>
          <PromptPreview template={previewTemplate} />
        </Modal>
      )}
    </div>
  );
};
