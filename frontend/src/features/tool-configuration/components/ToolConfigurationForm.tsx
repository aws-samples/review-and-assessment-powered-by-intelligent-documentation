import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CreateToolConfigurationRequest, KnowledgeBaseConfigUI, ToolConfiguration, PreviewToolsResult } from "../types";
import Button from "../../../components/Button";
import FormTextField from "../../../components/FormTextField";
import FormTextArea from "../../../components/FormTextArea";
import HelpIcon from "../../../components/HelpIcon";
import { HiExclamationCircle, HiInformationCircle, HiRefresh } from "react-icons/hi";
import MCPExamplesModal from "./MCPExamplesModal";
import MCPToolsPreview from "./MCPToolsPreview";
import { usePreviewMcpTools } from "../hooks/useToolConfigurationMutations";

const PLACEHOLDER_JSON = `{
  "aws-docs": {
    "command": "uvx",
    "args": ["awslabs.aws-documentation-mcp-server@latest"]
  }
}`;

type ToolConfigurationFormProps = {
  mode: 'create' | 'view' | 'edit';
  initialData?: ToolConfiguration;
  onSubmit: (data: CreateToolConfigurationRequest) => Promise<void>;
  onCancel: () => void;
};

export default function ToolConfigurationForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
}: ToolConfigurationFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [codeInterpreter, setCodeInterpreter] = useState(false);
  const [enableKB, setEnableKB] = useState(false);
  const [kbConfigs, setKbConfigs] = useState<KnowledgeBaseConfigUI[]>([
    { knowledgeBaseId: "", dataSourceIds: [], dataSourceIdsRaw: "" },
  ]);
  const [enableMCP, setEnableMCP] = useState(false);
  const [mcpConfigJson, setMcpConfigJson] = useState("");
  const [mcpJsonError, setMcpJsonError] = useState("");
  const [showExamplesModal, setShowExamplesModal] = useState(false);
  const [previewResults, setPreviewResults] = useState<PreviewToolsResult[] | null>(null);
  const { previewMcpTools, status: previewStatus } = usePreviewMcpTools();
  const [errors, setErrors] = useState({
    name: "",
    tools: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isReadOnly = mode === 'view';

  // 初期データの設定
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description || "");
      setCodeInterpreter(initialData.codeInterpreter);
      setEnableKB(!!initialData.knowledgeBase && initialData.knowledgeBase.length > 0);
      if (initialData.knowledgeBase && initialData.knowledgeBase.length > 0) {
        setKbConfigs(initialData.knowledgeBase.map(kb => ({
          ...kb,
          dataSourceIdsRaw: kb.dataSourceIds?.join(", ") || ""
        })));
      }
      setEnableMCP(!!initialData.mcpConfig && Object.keys(initialData.mcpConfig).length > 0);
      if (initialData.mcpConfig && Object.keys(initialData.mcpConfig).length > 0) {
        setMcpConfigJson(JSON.stringify(initialData.mcpConfig, null, 2));
      }
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isReadOnly) return;

    const newErrors = {
      name: "",
      tools: "",
    };

    if (!name.trim()) {
      newErrors.name = t("toolConfiguration.nameRequired");
    }

    if (!codeInterpreter && !enableKB && !enableMCP) {
      newErrors.tools = t("toolConfiguration.toolsRequired");
    }

    setErrors(newErrors);

    if (Object.values(newErrors).some((error) => error)) {
      return;
    }

    let parsedMcpConfig = undefined;
    if (enableMCP && mcpConfigJson.trim()) {
      try {
        parsedMcpConfig = JSON.parse(mcpConfigJson);

        // 構造バリデーション: オブジェクトであること
        if (typeof parsedMcpConfig !== 'object' || Array.isArray(parsedMcpConfig) || parsedMcpConfig === null) {
          throw new Error(t("toolConfiguration.mcpMustBeObject"));
        }

        // 各サーバーのバリデーション
        Object.entries(parsedMcpConfig).forEach(([serverName, cfg]: [string, any]) => {
          // HTTP判定：urlがhttp/httpsで始まる
          const url = cfg.url?.trim();
          const isHttp = url && (url.startsWith("http://") || url.startsWith("https://"));

          // stdio判定：commandとargsが存在
          const isStdio = cfg.command && cfg.args && Array.isArray(cfg.args) && cfg.args.length > 0;

          // どちらでもない場合はエラー
          if (!isHttp && !isStdio) {
            throw new Error(t("toolConfiguration.mcpInvalidConfig", { name: serverName }));
          }

          // HTTPの場合、commandやargsがあると混在エラー
          if (isHttp && (cfg.command || cfg.args)) {
            throw new Error(t("toolConfiguration.mcpConflictingFields", { name: serverName }));
          }

          // stdioの場合、argsが配列であることを確認
          if (isStdio && (!Array.isArray(cfg.args) || cfg.args.length === 0)) {
            throw new Error(t("toolConfiguration.mcpNeedsArgs", { name: serverName }));
          }
        });

        setMcpJsonError("");
      } catch (err: any) {
        setMcpJsonError(err.message);
        return;
      }
    }

    const data: CreateToolConfigurationRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      codeInterpreter,
      knowledgeBase: enableKB
        ? kbConfigs
            .filter((kb) => kb.knowledgeBaseId.trim())
            .map(({ dataSourceIdsRaw, ...kb }) => kb)
        : undefined,
      mcpConfig: parsedMcpConfig,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addKBConfig = () => {
    setKbConfigs([...kbConfigs, { knowledgeBaseId: "", dataSourceIds: [], dataSourceIdsRaw: "" }]);
  };

  const removeKBConfig = (index: number) => {
    setKbConfigs(kbConfigs.filter((_, i) => i !== index));
  };

  const updateKBConfig = (
    index: number,
    field: keyof KnowledgeBaseConfigUI,
    value: string
  ) => {
    console.log(`[DEBUG] updateKBConfig called - index: ${index}, field: ${field}, value: "${value}"`);
    const updated = [...kbConfigs];
    if (field === "knowledgeBaseId") {
      updated[index].knowledgeBaseId = value;
    } else if (field === "dataSourceIds") {
      updated[index].dataSourceIdsRaw = value;
      const parsed = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      console.log(`[DEBUG] Parsed dataSourceIds:`, parsed);
      updated[index].dataSourceIds = parsed;
    }
    console.log(`[DEBUG] Updated kbConfigs:`, updated);
    setKbConfigs(updated);
  };

  const handlePreviewTools = async () => {
    if (!mcpConfigJson.trim()) return;

    try {
      const parsed = JSON.parse(mcpConfigJson);
      const result = await previewMcpTools({ mcpConfig: parsed });
      setPreviewResults(result);
      setMcpJsonError("");
    } catch (error) {
      setMcpJsonError("Failed to preview tools");
    }
  };


  return (
    <form onSubmit={handleSubmit}>
      <FormTextField
        id="name"
        name="name"
        label={t("toolConfiguration.name")}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (errors.name) {
            setErrors((prev) => ({ ...prev, name: "" }));
          }
        }}
        placeholder={t("toolConfiguration.namePlaceholder")}
        required={!isReadOnly}
        error={errors.name}
        disabled={isReadOnly}
      />

      <FormTextArea
        id="description"
        name="description"
        label={t("toolConfiguration.description")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t("toolConfiguration.descriptionPlaceholder")}
        disabled={isReadOnly}
      />

      <div className="mb-6">
        <label className="mb-2 block font-medium text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
          {t("toolConfiguration.tools")} {!isReadOnly && <span className="text-red">*</span>}
        </label>

        {errors.tools && !isReadOnly && (
          <div className="mb-4 rounded-md border border-red bg-light-red px-4 py-3 text-sm text-red">
            <div className="flex items-center">
              <HiExclamationCircle className="mr-2 h-5 w-5" />
              <span>{errors.tools}</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={codeInterpreter}
              onChange={(e) => {
                setCodeInterpreter(e.target.checked);
                if (errors.tools) {
                  setErrors((prev) => ({ ...prev, tools: "" }));
                }
              }}
              className="h-4 w-4 rounded border-gray-300"
              disabled={isReadOnly}
            />
            <span className="text-sm text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
              {t("toolConfiguration.codeInterpreter")}
            </span>
            <HelpIcon content={t("toolConfiguration.codeInterpreterHelp")} />
          </label>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={enableKB}
                onChange={(e) => {
                  setEnableKB(e.target.checked);
                  if (errors.tools) {
                    setErrors((prev) => ({ ...prev, tools: "" }));
                  }
                }}
                className="h-4 w-4 rounded border-gray-300"
                disabled={isReadOnly}
              />
              <span className="text-sm text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
                {t("toolConfiguration.knowledgeBase")}
              </span>
              <HelpIcon content={t("toolConfiguration.knowledgeBaseHelp")} />
            </label>

            {enableKB && (
              <div className="ml-6 mt-4 space-y-4">
                <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
                  <HiInformationCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <div className="text-blue-900">
                    <strong>{t("common.warning")}:</strong> {t("toolConfiguration.knowledgeBaseWarning")}
                  </div>
                </div>
                {kbConfigs.map((kb, index) => (
                  <div
                    key={index}
                    className="space-y-3 rounded-lg border border-light-gray bg-aws-squid-ink-lightest p-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
                        {t("toolConfiguration.knowledgeBaseId")} {!isReadOnly && <span className="text-red">*</span>}
                      </label>
                      <input
                        type="text"
                        value={kb.knowledgeBaseId}
                        onChange={(e) =>
                          updateKBConfig(
                            index,
                            "knowledgeBaseId",
                            e.target.value
                          )
                        }
                        className="w-full rounded-md border border-light-gray px-4 py-2"
                        required={!isReadOnly}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
                        {t("toolConfiguration.dataSourceIds")}
                      </label>
                      <input
                        type="text"
                        value={kb.dataSourceIdsRaw || ""}
                        onChange={(e) => {
                          console.log(`[DEBUG] Input onChange - value: "${e.target.value}"`);
                          updateKBConfig(index, "dataSourceIds", e.target.value);
                        }}
                        className="w-full rounded-md border border-light-gray px-4 py-2"
                        disabled={isReadOnly}
                      />
                    </div>
                    {!isReadOnly && kbConfigs.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeKBConfig(index)}
                        variant="danger"
                        outline>
                        {t("toolConfiguration.remove")}
                      </Button>
                    )}
                  </div>
                ))}
                {!isReadOnly && (
                  <Button type="button" onClick={addKBConfig} outline>
                    {t("toolConfiguration.addKnowledgeBase")}
                  </Button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={enableMCP}
                onChange={(e) => {
                  setEnableMCP(e.target.checked);
                  if (errors.tools) {
                    setErrors((prev) => ({ ...prev, tools: "" }));
                  }
                }}
                className="h-4 w-4 rounded border-gray-300"
                disabled={isReadOnly}
              />
              <span className="text-sm text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
                {t("toolConfiguration.mcp")}
              </span>
              <HelpIcon content={t("toolConfiguration.mcpHelp")} />
              {!isReadOnly && (
                <Button
                  type="button"
                  onClick={() => setShowExamplesModal(true)}
                  variant="text"
                  size="sm">
                  {t("toolConfiguration.showExamples")}
                </Button>
              )}
            </label>

            {enableMCP && (
              <div className="ml-6 mt-4">
                <FormTextArea
                  id="mcpConfigJson"
                  name="mcpConfigJson"
                  label={t("toolConfiguration.mcpConfigJson")}
                  value={mcpConfigJson}
                  onChange={(e) => setMcpConfigJson(e.target.value)}
                  placeholder={PLACEHOLDER_JSON}
                  rows={20}
                  className="font-mono text-sm"
                  disabled={isReadOnly}
                />
                {mcpJsonError && (
                  <div className="mt-2 rounded-md border border-red bg-light-red px-4 py-3 text-sm text-red">
                    <div className="flex items-center">
                      <HiExclamationCircle className="mr-2 h-5 w-5 flex-shrink-0" />
                      <span>{mcpJsonError}</span>
                    </div>
                  </div>
                )}

                {!isReadOnly && (
                  <Button
                    type="button"
                    onClick={handlePreviewTools}
                    variant="secondary"
                    outline
                    disabled={!mcpConfigJson.trim() || previewStatus === "loading"}
                    className="mt-2"
                  >
                    {previewStatus === "loading" ? (
                      <>
                        <HiRefresh className="mr-2 h-4 w-4 animate-spin" />
                        {t("toolConfiguration.loading")}
                      </>
                    ) : (
                      t("toolConfiguration.previewTools")
                    )}
                  </Button>
                )}

                {previewResults && <MCPToolsPreview results={previewResults} />}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end space-x-3">
        <Button type="button" onClick={onCancel} outline>
          {isReadOnly ? t("common.close") : t("common.cancel")}
        </Button>
        {!isReadOnly && (
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting && (
              <div className="-ml-1 mr-2 h-4 w-4 animate-spin text-white">
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"></div>
              </div>
            )}
            {mode === 'create' ? t("common.create") : t("common.save")}
          </Button>
        )}
      </div>

      <MCPExamplesModal
        isOpen={showExamplesModal}
        onClose={() => setShowExamplesModal(false)}
        onSelect={(json) => setMcpConfigJson(json)}
      />
    </form>
  );
}
