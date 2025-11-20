import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronDown, HiChevronRight, HiCheckCircle, HiXCircle } from "react-icons/hi";
import Button from "../../../components/Button";
import Tooltip from "../../../components/Tooltip";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import python from "react-syntax-highlighter/dist/esm/languages/hljs/python";

SyntaxHighlighter.registerLanguage("python", python);

interface CodeInterpreterSourceItemProps {
  source: {
    toolUseId: string;
    toolName: string;
    input?: any;
    output?: string;
    status?: "success" | "error" | "unknown";
  };
}

export default function CodeInterpreterSourceItem({ source }: CodeInterpreterSourceItemProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const output = source.output ? JSON.parse(source.output) : null;
  const hasError = output && (output.exitCode !== 0 || output.stderr?.trim());
  const inputCode = source.input?.code || "";

  return (
    <div className="mt-1 rounded border border-light-gray bg-aws-paper-light p-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasError ? (
            <HiXCircle className="h-4 w-4 text-red-600" />
          ) : (
            <HiCheckCircle className="h-4 w-4 text-green-600" />
          )}
          <div className="flex items-center gap-1">
            <span className="font-medium text-aws-squid-ink-light">
              {t("review.sources.codeInterpreter.title")}
            </span>
            <Tooltip content={t("review.sources.codeInterpreter.tooltip")} position="top">
              <span className="text-xs text-aws-font-color-blue cursor-help underline decoration-dotted">?</span>
            </Tooltip>
          </div>
        </div>
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          variant="text"
          size="sm"
          className="p-0"
          icon={isExpanded ? <HiChevronDown className="h-4 w-4" /> : <HiChevronRight className="h-4 w-4" />}
        />
      </div>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {inputCode && (
            <div className="text-aws-font-color-gray">
              <span className="font-medium">{t("review.sources.codeInterpreter.input")}:</span>
              <SyntaxHighlighter
                language="python"
                style={atomOneDark}
                showLineNumbers={true}
                customStyle={{
                  margin: "0.25rem 0 0 0",
                  borderRadius: "0.375rem",
                  fontSize: "0.75rem",
                  padding: "0.5rem",
                  maxHeight: "300px",
                  overflow: "auto",
                }}
                lineNumberStyle={{ color: "#6b7280", opacity: 0.8 }}
              >
                {inputCode}
              </SyntaxHighlighter>
            </div>
          )}

          {output && (
            <div className="text-aws-font-color-gray">
              <span className="font-medium">{t("review.sources.codeInterpreter.output")}:</span>
              {hasError ? (
                <div className="rounded bg-red-900 bg-opacity-10 border border-red-600 p-3 mt-1">
                  <div className="flex items-center gap-2 mb-2 text-red-600 font-medium text-sm">
                    <HiXCircle className="h-4 w-4" />
                    {t("review.sources.codeInterpreter.executionError")}
                    {output.exitCode !== undefined && (
                      <span className="text-xs">
                        ({t("review.sources.codeInterpreter.exitCode")}: {output.exitCode})
                      </span>
                    )}
                  </div>
                  <SyntaxHighlighter
                    language="python"
                    style={atomOneDark}
                    showLineNumbers={true}
                    customStyle={{
                      margin: 0,
                      borderRadius: "0.375rem",
                      fontSize: "0.75rem",
                      backgroundColor: "#1e1e1e",
                    }}
                    lineNumberStyle={{ color: "#858585", opacity: 0.8 }}
                  >
                    {output.stderr}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <SyntaxHighlighter
                  language="plaintext"
                  style={atomOneDark}
                  showLineNumbers={false}
                  customStyle={{
                    margin: "0.25rem 0 0 0",
                    borderRadius: "0.375rem",
                    fontSize: "0.75rem",
                    maxHeight: "400px",
                    overflow: "auto",
                  }}
                >
                  {output.stdout}
                </SyntaxHighlighter>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
