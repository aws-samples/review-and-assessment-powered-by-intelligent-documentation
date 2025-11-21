import React from "react";
import { HiExternalLink } from "react-icons/hi";
import { useToolConfigurations } from "../../tool-configuration/hooks/useToolConfigurationQueries";
import Modal from "../../../components/Modal";

interface AssignToolConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (configId: string | null) => void;
  currentConfigId?: string;
}

export default function AssignToolConfigModal({
  isOpen,
  onClose,
  onAssign,
  currentConfigId,
}: AssignToolConfigModalProps) {
  const { toolConfigurations, isLoading } = useToolConfigurations();

  const handleAssign = (configId: string | null) => {
    onAssign(configId);
    onClose();
  };

  const getToolsText = (config: (typeof toolConfigurations)[0]) => {
    const tools = [];
    if (config.knowledgeBase && config.knowledgeBase.length > 0) {
      tools.push(`KB (${config.knowledgeBase.length})`);
    }
    if (config.codeInterpreter) {
      tools.push("Code Interpreter");
    }
    if (config.mcpConfig) {
      tools.push("MCP");
    }
    return tools.join(", ") || "None";
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Tool Configuration">
      <div className="space-y-2">
        {isLoading ? (
          <div className="py-4 text-center text-aws-font-color-gray">
            Loading...
          </div>
        ) : toolConfigurations.length === 0 ? (
          <div className="py-8 text-center">
            <p className="mb-4 text-sm text-aws-font-color-gray">
              No tool configurations found. Please create one first.
            </p>
            <a
              href="/tool-configurations/new"
              className="inline-block rounded-lg bg-aws-sea-blue-light px-4 py-2 text-sm font-medium text-white hover:bg-aws-sea-blue-hover-light">
              Create Tool Configuration
            </a>
          </div>
        ) : (
          <>
            {toolConfigurations.map((config) => (
              <div
                key={config.id}
                className={`relative rounded-lg border bg-white transition-colors ${
                  currentConfigId === config.id
                    ? "border-aws-sea-blue-light"
                    : "border-light-gray"
                }`}>
                <button
                  onClick={() => handleAssign(config.id)}
                  className="w-full p-4 text-left hover:bg-aws-paper-light">
                  <div className="text-sm font-medium text-aws-squid-ink-light">
                    {config.name}
                  </div>
                  {config.description && (
                    <div className="mt-1 text-sm text-aws-font-color-gray">
                      {config.description}
                    </div>
                  )}
                  <div className="mt-1 text-sm text-aws-font-color-gray">
                    {getToolsText(config)}
                  </div>
                </button>
                <a
                  href={`/tool-configurations/${config.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-2 top-2 rounded p-1 text-aws-font-color-gray hover:bg-aws-paper-light hover:text-aws-squid-ink-light">
                  <HiExternalLink className="h-4 w-4" />
                </a>
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}
