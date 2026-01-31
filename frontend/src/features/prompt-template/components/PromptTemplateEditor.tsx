import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FormTextField } from "../../../components/FormTextField";
import { FormTextArea } from "../../../components/FormTextArea";
import { Button } from "../../../components/Button";
import {
  PromptTemplate,
  PromptTemplateType,
  UpdatePromptTemplateRequest,
} from "../types";
import { DEFAULT_CHECKLIST_PROMPT, DEFAULT_REVIEW_PROMPT, DEFAULT_NEXT_ACTION_PROMPT } from "../constants";

interface PromptTemplateEditorProps {
  template?: PromptTemplate;
  type: PromptTemplateType;
  onSave: (data: UpdatePromptTemplateRequest) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export const PromptTemplateEditor: React.FC<PromptTemplateEditorProps> = ({
  template,
  type,
  onSave,
  onCancel,
  isSubmitting,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [prompt, setPrompt] = useState(
    template?.prompt ||
      (type === PromptTemplateType.CHECKLIST
        ? DEFAULT_CHECKLIST_PROMPT
        : type === PromptTemplateType.REVIEW
          ? DEFAULT_REVIEW_PROMPT
          : type === PromptTemplateType.NEXT_ACTION
            ? DEFAULT_NEXT_ACTION_PROMPT
            : "")
  );
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setPrompt(template.prompt);
      setIsDirty(false);
    }
  }, [template]);

  const handleChange = () => {
    setIsDirty(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      name,
      description,
      prompt,
    });
    setIsDirty(false);
  };

  const handleReset = () => {
    if (type === PromptTemplateType.CHECKLIST) {
      setPrompt(DEFAULT_CHECKLIST_PROMPT);
      setIsDirty(true);
    } else if (type === PromptTemplateType.REVIEW) {
      setPrompt(DEFAULT_REVIEW_PROMPT);
      setIsDirty(true);
    } else if (type === PromptTemplateType.NEXT_ACTION) {
      setPrompt(DEFAULT_NEXT_ACTION_PROMPT);
      setIsDirty(true);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <FormTextField
          id="template-name"
          name="name"
          label={t("promptTemplate.templateName")}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            handleChange();
          }}
          required
        />

        <FormTextField
          id="template-description"
          name="description"
          label={t("promptTemplate.description")}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            handleChange();
          }}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="template-prompt"
              className="block text-sm font-medium text-aws-font-color-light dark:text-aws-font-color-dark">
              {t("promptTemplate.prompt")}
            </label>
            <Button
              type="button"
              outline
              size="sm"
              onClick={handleReset}
              disabled={isSubmitting}>
              {t("promptTemplate.resetToDefault")}
            </Button>
          </div>
          <FormTextArea
            id="template-prompt"
            name="prompt"
            label=""
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              handleChange();
            }}
            rows={20}
            className="font-mono text-sm"
            required
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          outline
          onClick={onCancel}
          disabled={isSubmitting}>
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!isDirty || isSubmitting || !name || !prompt}>
          {isSubmitting ? t("common.processing") : t("common.save")}
        </Button>
      </div>
    </form>
  );
};
