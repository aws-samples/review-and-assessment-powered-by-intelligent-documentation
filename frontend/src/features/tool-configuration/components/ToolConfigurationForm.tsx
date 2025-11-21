import React, { useState, useEffect } from "react";
import { CreateToolConfigurationRequest, KnowledgeBaseConfig, ToolConfiguration } from "../types";
import Button from "../../../components/Button";
import FormTextField from "../../../components/FormTextField";
import FormTextArea from "../../../components/FormTextArea";
import { HiExclamationCircle } from "react-icons/hi";

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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [codeInterpreter, setCodeInterpreter] = useState(false);
  const [enableKB, setEnableKB] = useState(false);
  const [kbConfigs, setKbConfigs] = useState<KnowledgeBaseConfig[]>([
    { knowledgeBaseId: "", dataSourceIds: [] },
  ]);
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
        setKbConfigs(initialData.knowledgeBase);
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
      newErrors.name = "Name is required";
    }

    if (!codeInterpreter && !enableKB) {
      newErrors.tools = "At least one tool must be enabled";
    }

    setErrors(newErrors);

    if (Object.values(newErrors).some((error) => error)) {
      return;
    }

    const data: CreateToolConfigurationRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      codeInterpreter,
      knowledgeBase: enableKB
        ? kbConfigs.filter((kb) => kb.knowledgeBaseId.trim())
        : undefined,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addKBConfig = () => {
    setKbConfigs([...kbConfigs, { knowledgeBaseId: "", dataSourceIds: [] }]);
  };

  const removeKBConfig = (index: number) => {
    setKbConfigs(kbConfigs.filter((_, i) => i !== index));
  };

  const updateKBConfig = (
    index: number,
    field: keyof KnowledgeBaseConfig,
    value: string
  ) => {
    const updated = [...kbConfigs];
    if (field === "knowledgeBaseId") {
      updated[index].knowledgeBaseId = value;
    } else if (field === "dataSourceIds") {
      updated[index].dataSourceIds = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    setKbConfigs(updated);
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormTextField
        id="name"
        name="name"
        label="Name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (errors.name) {
            setErrors((prev) => ({ ...prev, name: "" }));
          }
        }}
        placeholder="Enter configuration name"
        required={!isReadOnly}
        error={errors.name}
        disabled={isReadOnly}
      />

      <FormTextArea
        id="description"
        name="description"
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Enter description (optional)"
        disabled={isReadOnly}
      />

      <div className="mb-6">
        <label className="mb-2 block font-medium text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
          Tools {!isReadOnly && <span className="text-red">*</span>}
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
              Code Interpreter
            </span>
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
                Knowledge Base
              </span>
            </label>

            {enableKB && (
              <div className="ml-6 mt-4 space-y-4">
                {kbConfigs.map((kb, index) => (
                  <div
                    key={index}
                    className="space-y-3 rounded-lg border border-light-gray bg-aws-squid-ink-lightest p-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
                        Knowledge Base ID {!isReadOnly && <span className="text-red">*</span>}
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
                        Data Source IDs (comma-separated, optional)
                      </label>
                      <input
                        type="text"
                        value={kb.dataSourceIds?.join(", ") || ""}
                        onChange={(e) =>
                          updateKBConfig(index, "dataSourceIds", e.target.value)
                        }
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
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                {!isReadOnly && (
                  <Button type="button" onClick={addKBConfig} outline>
                    Add Knowledge Base
                  </Button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 opacity-50">
              <input
                type="checkbox"
                checked={false}
                disabled={true}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
                MCP (Model Context Protocol)
              </span>
              <span className="text-xs text-aws-font-color-gray italic">
                Coming Soon
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end space-x-3">
        <Button type="button" onClick={onCancel} outline>
          {isReadOnly ? 'Close' : 'Cancel'}
        </Button>
        {!isReadOnly && (
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting && (
              <div className="-ml-1 mr-2 h-4 w-4 animate-spin text-white">
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"></div>
              </div>
            )}
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        )}
      </div>
    </form>
  );
}
