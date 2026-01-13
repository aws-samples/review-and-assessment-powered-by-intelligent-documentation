import React, { useState } from "react";
import Modal from "../../../components/Modal";
import Button from "../../../components/Button";
import { useTranslation } from "react-i18next";
import { HiClipboardCopy, HiCheck } from "react-icons/hi";

interface MCPExamplesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (json: string) => void;
}

interface ExampleItem {
  title: string;
  description: string;
  json: Record<string, any>;
}

const EXAMPLES: Record<string, ExampleItem> = {
  single: {
    title: "Single MCP Server",
    description: "Amazon Location Service",
    json: {
      "aws-location": {
        command: "uvx",
        args: ["awslabs.aws-location-mcp-server@latest"]
      }
    }
  },
  multiple: {
    title: "Multiple MCP Servers",
    description: "uvx, npx, and HTTP remote",
    json: {
      "aws-location": {
        command: "uvx",
        args: ["awslabs.aws-location-mcp-server@latest"]
      },
      "example-server": {
        command: "npx",
        args: ["@modelcontextprotocol/server-example"]
      },
      "remote-server": {
        command: "uvx",
        args: ["fastmcp", "run", "https://mcp-server.example.com"],
        url: "",
        timeout: 120000
      }
    }
  }
};

export default function MCPExamplesModal({
  isOpen,
  onClose,
  onSelect,
}: MCPExamplesModalProps) {
  const { t } = useTranslation();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, json: any) => {
    navigator.clipboard.writeText(JSON.stringify(json, null, 2));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleUse = (json: any) => {
    onSelect(JSON.stringify(json, null, 2));
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("toolConfiguration.mcpExamples")}
      size="2xl">
      <div className="space-y-4">
        {Object.entries(EXAMPLES).map(([key, example]) => (
          <div
            key={key}
            className="rounded-lg border border-light-gray bg-white p-4 dark:bg-aws-squid-ink-darkest dark:border-aws-squid-ink-dark">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
                  {example.title}
                </h3>
                <p className="text-sm text-aws-font-color-gray dark:text-aws-font-color-gray-dark">
                  {example.description}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => handleCopy(key, example.json)}
                  variant="secondary"
                  size="sm"
                  outline>
                  {copiedKey === key ? <HiCheck /> : <HiClipboardCopy />}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleUse(example.json)}
                  variant="primary"
                  size="sm"
                  outline>
                  {t("toolConfiguration.useExample")}
                </Button>
              </div>
            </div>
            <pre className="mt-2 overflow-x-auto rounded bg-gray-100 p-3 text-xs dark:bg-aws-squid-ink-dark">
              {JSON.stringify(example.json, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </Modal>
  );
}
