import { useState } from "react";
import {
  HiChevronDown,
  HiChevronRight,
  HiCheckCircle,
  HiXCircle,
  HiQuestionMarkCircle,
} from "react-icons/hi";
import Button from "../../../components/Button";

interface ExternalSourceItemProps {
  source: {
    toolUseId: string;
    toolName: string;
    input?: any;
    output?: string;
    status?: "success" | "error" | "unknown";
  };
}

export default function ExternalSourceItem({
  source,
}: ExternalSourceItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isInputObject = source.input && typeof source.input === "object";

  const getStatusIcon = () => {
    if (source.status === "success") {
      return <HiCheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (source.status === "error") {
      return <HiXCircle className="h-4 w-4 text-red-600" />;
    }
    return <HiQuestionMarkCircle className="h-4 w-4 text-gray-600" />;
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
              <span className="font-medium">Input:</span>
              {isInputObject ? (
                <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-xs">
                  {JSON.stringify(source.input, null, 2)}
                </pre>
              ) : (
                <span className="ml-1">{String(source.input)}</span>
              )}
            </div>
          )}
          {source.output && (
            <div className="text-aws-font-color-gray">
              <span className="font-medium">Output:</span>
              <div className="mt-1 overflow-x-auto rounded bg-white p-2">
                {source.output}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
