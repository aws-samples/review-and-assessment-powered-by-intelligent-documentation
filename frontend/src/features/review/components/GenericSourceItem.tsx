import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiChevronDown,
  HiChevronRight,
  HiCheckCircle,
  HiXCircle,
  HiQuestionMarkCircle,
  HiExclamation,
} from "react-icons/hi";
import Button from "../../../components/Button";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import untruncateJson from "untruncate-json";
import python from "react-syntax-highlighter/dist/esm/languages/hljs/python";
import javascript from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import typescript from "react-syntax-highlighter/dist/esm/languages/hljs/typescript";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import bash from "react-syntax-highlighter/dist/esm/languages/hljs/bash";

SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("bash", bash);

interface ParsedOutput {
  type: "code" | "json" | "error" | "text";
  content: string;
  language?: string;
  isTruncated?: boolean;
  metadata?: {
    stdout?: string;
    stderr?: string;
    exitCode?: number;
  };
}

function parseOutput(output: string): ParsedOutput {
  const isTruncated = output.startsWith("<!TRUNCATED>");
  let cleanOutput = isTruncated ? output.replace("<!TRUNCATED>", "") : output;

  try {
    const parsed = JSON.parse(cleanOutput);

    if (parsed.code && typeof parsed.code === "string") {
      return {
        type: "code",
        content: parsed.code,
        language: "python",
        isTruncated,
      };
    }

    if (parsed.stdout !== undefined || parsed.stderr !== undefined) {
      const hasError = (parsed.exitCode !== undefined && parsed.exitCode !== 0) || (parsed.stderr && parsed.stderr.trim() !== "");
      const content = hasError ? (parsed.stderr || parsed.stdout || "") : (parsed.stdout || "");
      
      return {
        type: hasError ? "error" : "text",
        content: content,
        isTruncated,
        metadata: {
          stdout: parsed.stdout,
          stderr: parsed.stderr,
          exitCode: parsed.exitCode,
        },
      };
    }

    return {
      type: "json",
      content: JSON.stringify(parsed, null, 2),
      language: "json",
      isTruncated,
    };
  } catch (e) {
    try {
      const fixedJson = untruncateJson(cleanOutput);
      const parsed = JSON.parse(fixedJson);
      
      if (parsed.code && typeof parsed.code === "string") {
        return {
          type: "code",
          content: parsed.code,
          language: "python",
          isTruncated: true,
        };
      }

      if (parsed.stdout !== undefined || parsed.stderr !== undefined) {
        const hasError = (parsed.exitCode !== undefined && parsed.exitCode !== 0) || (parsed.stderr && parsed.stderr.trim() !== "");
        const content = hasError ? (parsed.stderr || parsed.stdout || "") : (parsed.stdout || "");
        
        return {
          type: hasError ? "error" : "text",
          content: content,
          isTruncated: true,
          metadata: {
            stdout: parsed.stdout,
            stderr: parsed.stderr,
            exitCode: parsed.exitCode,
          },
        };
      }

      return {
        type: "json",
        content: JSON.stringify(parsed, null, 2),
        language: "json",
        isTruncated: true,
      };
    } catch {
      return {
        type: "text",
        content: cleanOutput,
        isTruncated: true,
      };
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

  const isInputObject = source.input && typeof source.input === "object";
  const parsedOutput = source.output ? parseOutput(source.output) : null;

  const inputHasCode = isInputObject && source.input.code && typeof source.input.code === "string";
  const inputContent = inputHasCode ? source.input.code : (isInputObject ? JSON.stringify(source.input, null, 2) : String(source.input));

  const getStatusIcon = () => {
    if (source.status === "success") {
      return <HiCheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (source.status === "error") {
      return <HiXCircle className="h-4 w-4 text-red-600" />;
    }
    return <HiQuestionMarkCircle className="h-4 w-4 text-gray-600" />;
  };

  const renderOutput = () => {
    if (!parsedOutput) return null;

    return (
      <div className="text-aws-font-color-gray">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium">{t("review.output")}:</span>
          {parsedOutput.isTruncated && (
            <span className="flex items-center gap-1 text-xs text-yellow-600">
              <HiExclamation className="h-3 w-3" />
              Truncated
            </span>
          )}
        </div>

        {(parsedOutput.type === "code" || parsedOutput.type === "json") && (
          <SyntaxHighlighter
            language={parsedOutput.language}
            style={atomOneDark}
            showLineNumbers={true}
            customStyle={{
              margin: 0,
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
              maxHeight: "400px",
              overflow: "auto",
            }}
            lineNumberStyle={{
              color: "#6b7280",
              opacity: 0.8,
            }}
          >
            {parsedOutput.content}
          </SyntaxHighlighter>
        )}

        {parsedOutput.type === "error" && (
          <div className="rounded bg-red-900 bg-opacity-10 border border-red-600 p-3">
            <div className="flex items-center gap-2 mb-2 text-red-600 font-medium text-sm">
              <HiXCircle className="h-4 w-4" />
              Execution Error
              {parsedOutput.metadata?.exitCode !== undefined && (
                <span className="text-xs">
                  (Exit Code: {parsedOutput.metadata.exitCode})
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
              lineNumberStyle={{
                color: "#858585",
                opacity: 0.8,
              }}
            >
              {parsedOutput.content}
            </SyntaxHighlighter>
          </div>
        )}

        {parsedOutput.type === "text" && (
          <SyntaxHighlighter
            language="plaintext"
            style={atomOneDark}
            showLineNumbers={false}
            customStyle={{
              margin: 0,
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
              maxHeight: "400px",
              overflow: "auto",
            }}
          >
            {parsedOutput.content}
          </SyntaxHighlighter>
        )}
      </div>
    );
  };

  return (
    <div className="mt-1 rounded border border-light-gray bg-aws-paper-light p-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium text-aws-squid-ink-light">
            {source.toolName}
          </span>
        </div>
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          variant="text"
          size="sm"
          className="p-0"
          icon={
            isExpanded ? (
              <HiChevronDown className="h-4 w-4" />
            ) : (
              <HiChevronRight className="h-4 w-4" />
            )
          }
        />
      </div>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {source.input && (
            <div className="text-aws-font-color-gray">
              <span className="font-medium">{t("review.input")}:</span>
              <SyntaxHighlighter
                language={inputHasCode ? "python" : "json"}
                style={atomOneDark}
                showLineNumbers={inputHasCode}
                customStyle={{
                  margin: "0.25rem 0 0 0",
                  borderRadius: "0.375rem",
                  fontSize: "0.75rem",
                  padding: "0.5rem",
                  maxHeight: "300px",
                  overflow: "auto",
                }}
                lineNumberStyle={{
                  color: "#6b7280",
                  opacity: 0.8,
                }}
              >
                {inputContent}
              </SyntaxHighlighter>
            </div>
          )}
          {source.output && renderOutput()}
        </div>
      )}
    </div>
  );
}
