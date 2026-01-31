import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FormTextField } from "../../../components/FormTextField";
import { FormTextArea } from "../../../components/FormTextArea";
import { FormSelect } from "../../../components/FormSelect";
import { Button } from "../../../components/Button";
import {
  PromptTemplate,
  PromptTemplateType,
  UpdatePromptTemplateRequest,
} from "../types";
import { DEFAULT_CHECKLIST_PROMPT, DEFAULT_REVIEW_PROMPT, DEFAULT_NEXT_ACTION_PROMPT } from "../constants";
import { useToolConfigurations } from "../../tool-configuration/hooks/useToolConfigurationQueries";

// Next Action用テンプレート変数の定義
const NEXT_ACTION_TEMPLATE_VARIABLES = [
  { variable: "{{checklist_name}}", key: "checklist_name" },
  { variable: "{{pass_count}}", key: "pass_count" },
  { variable: "{{fail_count}}", key: "fail_count" },
  { variable: "{{failed_items}}", key: "failed_items" },
  { variable: "{{user_overrides}}", key: "user_overrides" },
  { variable: "{{document_info}}", key: "document_info" },
  { variable: "{{all_results}}", key: "all_results" },
];

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
  const [toolConfigurationId, setToolConfigurationId] = useState<string | undefined>(
    template?.toolConfigurationId
  );
  const [isDirty, setIsDirty] = useState(false);

  // NEXT_ACTIONタイプの場合のみツール設定を取得
  const { toolConfigurations } = useToolConfigurations();

  // テンプレート変数をカーソル位置に挿入
  const handleInsertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const scrollTop = textarea.scrollTop; // スクロール位置を保存
      const newPrompt = prompt.substring(0, start) + variable + prompt.substring(end);
      setPrompt(newPrompt);
      setIsDirty(true);
      // カーソル位置とスクロール位置を復元
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
        textarea.scrollTop = scrollTop; // スクロール位置を復元
      }, 0);
    } else {
      // refが取得できない場合は末尾に追加
      setPrompt(prompt + variable);
      setIsDirty(true);
    }
  };

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setPrompt(template.prompt);
      setToolConfigurationId(template.toolConfigurationId);
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
      toolConfigurationId: type === PromptTemplateType.NEXT_ACTION
        ? toolConfigurationId ?? null
        : undefined,
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

        {/* NEXT_ACTIONタイプの場合のみツール設定選択を表示 */}
        {type === PromptTemplateType.NEXT_ACTION && (
          <FormSelect
            id="tool-configuration"
            name="toolConfiguration"
            label={t("promptTemplate.toolConfiguration")}
            value={toolConfigurationId || ""}
            onChange={(e) => {
              setToolConfigurationId(e.target.value || undefined);
              handleChange();
            }}
            options={[
              { value: "", label: t("promptTemplate.noToolConfiguration") },
              ...toolConfigurations.map((tc) => ({
                value: tc.id,
                label: tc.name,
              })),
            ]}
          />
        )}

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

          {/* NEXT_ACTIONタイプの場合のみテンプレート変数ヘルパーを表示 */}
          {type === PromptTemplateType.NEXT_ACTION && (
            <div className="rounded-md border border-aws-squid-ink-light/20 dark:border-aws-font-color-white-dark/20 p-3 bg-aws-paper dark:bg-aws-squid-ink-light/10">
              <div className="text-sm font-medium text-aws-font-color-light dark:text-aws-font-color-dark mb-2">
                {t("promptTemplate.templateVariables")}
              </div>
              <div className="space-y-1">
                {NEXT_ACTION_TEMPLATE_VARIABLES.map(({ variable, key }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between text-sm py-1">
                    <span className="text-aws-font-color-gray dark:text-aws-font-color-white-dark/70">
                      <code className="bg-aws-squid-ink-light/5 dark:bg-aws-font-color-white-dark/10 px-1 rounded">
                        {variable}
                      </code>
                      : {t(`promptTemplate.variables.${key}`)}
                    </span>
                    <Button
                      type="button"
                      outline
                      size="sm"
                      onClick={() => handleInsertVariable(variable)}
                      disabled={isSubmitting}>
                      {t("promptTemplate.insert")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            id="template-prompt"
            name="prompt"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              handleChange();
            }}
            rows={20}
            className="w-full px-4 py-2 border border-light-gray rounded-md focus:outline-none focus:ring-2 focus:ring-aws-sea-blue-light font-mono text-sm"
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
