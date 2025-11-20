import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronDown, HiChevronRight, HiCheckCircle, HiXCircle, HiQuestionMarkCircle, HiExclamation } from "react-icons/hi";
import Button from "../../../components/Button";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import untruncateJson from "untruncate-json";
import python from "react-syntax-highlighter/dist/esm/languages/hljs/python";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";

SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("json", json);

interface ParsedOutput {
  type: "code" | "json" | "error" | "text";
  content: string;
  language?: string;
  isTruncated: boolean;
  exitCode?: number;
}

function parseOutput(output: string): ParsedOutput {
  const isTruncated = output.startsWith("<!TRUNCATED>");
  const cleanOutput = isTruncated ? output.slice(13) : output;

  try {
    const parsed = JSON.parse(cleanOutput);

    if (parsed.code) {
      return { type: "code", content: parsed.code, language: "python", isTruncated };
    }

    if (parsed.stdout !== undefined || parsed.stderr !== undefined) {
      const hasError = parsed.exitCode !== 0 || parsed.stderr?.trim();
      return {
        type: hasError ? "error" : "text",
        content: hasError ? parsed.stderr : parsed.stdout,
        isTruncated,
        exitCode: parsed.exitCode,
      };
    }

    return { type: "json", content: JSON.stringify(parsed, null, 2), language: "json", isTruncated };
  } catch {
    try {
      const fixed = JSON.parse(untruncateJson(cleanOutput));
      return { type: "json", content: JSON.stringify(fixed, null, 2), language: "json", isTruncated: true };
    } catch {
      return { type: "text", content: cleanOutput, isTruncated: true };
    }
  }
}

interface GenericSourceItemProps {
  source: {
    toolUseId: string;
    toolName: string;
    input?: any;
    output?: string;
    status?: "success" | "error" | "unknown";
  };
}

export default function GenericSourceItem({ source }: GenericSourceItemProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const parsed = source.output ? parseOutput(source.output) : null;
  const inputCode = source.input?.code;
  const inputDisplay = inputCode || (typeof source.input === "object" ? JSON.stringify(source.input, null, 2) : source.input);

  const statusIcon = {
    success: <HiCheckCircle className="h-4 w-4 text-green-600" />,
    error: <HiXCircle className="h-4 w-4 text-red-600" />,
    unknown: <HiQuestionMarkCircle className="h-4 w-4 text-gray-600" />,
  }[source.status || "unknown"];

  return (
    <div className="rounded border border-light-gray bg-aws-paper-light p-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="font-medium text-aws-squid-ink-light">
            {t("review.sources.generic.title")}: {source.toolName}
          </span>
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
        <div className="mt-3 space-y-3">
          {source.input && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-aws-squid-ink-light">
                  {t("review.sources.generic.input")}:
                </span>
              </div>
              <SyntaxHighlighter
                language={inputCode ? "python" : "json"}
                style={atomOneDark}
                showLineNumbers={!!inputCode}
                customStyle={{
                  margin: 0,
                  borderRadius: "0.375rem",
                  fontSize: "0.75rem",
                  padding: "0.75rem",
                  maxHeight: "300px",
                  overflow: "auto",
                }}
                lineNumberStyle={{ color: "#6b7280", opacity: 0.8 }}
              >
                {inputDisplay}
              </SyntaxHighlighter>
            </div>
          )}

          {parsed && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-aws-squid-ink-light">
                  {t("review.sources.generic.output")}:
                </span>
                {parsed.isTruncated && (
                  <span className="flex items-center gap-1 text-xs text-yellow-600">
                    <HiExclamation className="h-3 w-3" />
                    {t("review.sources.generic.truncated")}
                  </span>
                )}
              </div>

              {parsed.type === "error" ? (
                <div className="rounded border border-red-300 bg-red-50 p-3">
                  <div className="flex items-center gap-2 mb-2 text-red-700 font-medium">
                    <HiXCircle className="h-4 w-4" />
                    {t("review.sources.generic.executionError")}
                    {parsed.exitCode !== undefined && (
                      <span className="text-xs">
                        ({t("review.sources.generic.exitCode")}: {parsed.exitCode})
                      </span>
                    )}
                  </div>
                  <SyntaxHighlighter
                    language="python"
                    style={atomOneDark}
                    showLineNumbers={true}
                    customStyle={{ margin: 0, borderRadius: "0.375rem", fontSize: "0.75rem", padding: "0.75rem" }}
                    lineNumberStyle={{ color: "#858585", opacity: 0.8 }}
                  >
                    {parsed.content}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <SyntaxHighlighter
                  language={parsed.language || "plaintext"}
                  style={atomOneDark}
                  showLineNumbers={parsed.type === "code" || parsed.type === "json"}
                  customStyle={{ margin: 0, borderRadius: "0.375rem", fontSize: "0.75rem", padding: "0.75rem", maxHeight: "400px", overflow: "auto" }}
                  lineNumberStyle={{ color: "#6b7280", opacity: 0.8 }}
                >
                  {parsed.content}
                </SyntaxHighlighter>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
