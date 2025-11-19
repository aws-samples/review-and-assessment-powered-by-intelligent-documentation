import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronDown, HiChevronRight, HiCheckCircle, HiDocumentText, HiExternalLink } from "react-icons/hi";
import Button from "../../../components/Button";

interface KBResult {
  text: string;
  location?: string;
  metadata?: {
    page?: number;
  };
}

interface KnowledgeBaseSourceItemProps {
  source: {
    toolUseId: string;
    toolName: string;
    input?: any;
    output?: string;
    status?: "success" | "error" | "unknown";
  };
}

export default function KnowledgeBaseSourceItem({ source }: KnowledgeBaseSourceItemProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const data = source.output ? JSON.parse(source.output) : null;
  const query = source.input?.query || "";

  const getDocumentName = (location?: string) => {
    if (!location) return "Document";
    return location.split("/").pop() || "Document";
  };

  return (
    <div className="rounded border border-light-gray bg-aws-paper-light p-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HiCheckCircle className="h-4 w-4 text-green-600" />
          <span className="font-medium text-aws-squid-ink-light">{source.toolName}</span>
        </div>
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          variant="text"
          size="sm"
          className="p-0"
          icon={isExpanded ? <HiChevronDown className="h-4 w-4" /> : <HiChevronRight className="h-4 w-4" />}
        />
      </div>

      {isExpanded && data && (
        <div className="mt-3 space-y-3">
          {query && (
            <div>
              <p className="mb-1 font-medium text-aws-squid-ink-light">{t("review.kb.searchKeywords")}:</p>
              <p className="text-aws-font-color-gray">{query}</p>
            </div>
          )}

          <div>
            <p className="mb-2 font-medium text-aws-squid-ink-light">
              {t("review.kb.results")} ({data.results?.length || 0})
            </p>
            <div className="space-y-2">
              {data.results?.map((result: KBResult, idx: number) => (
                <div key={idx} className="rounded border border-light-gray bg-white p-3">
                  <p className="text-aws-font-color-gray leading-relaxed mb-2">{result.text}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-light-gray">
                    <div className="flex items-center gap-3 text-xs text-aws-font-color-gray">
                      <div className="flex items-center gap-1">
                        <HiDocumentText className="h-3 w-3" />
                        <span>{getDocumentName(result.location)}</span>
                      </div>
                      {result.metadata?.page && (
                        <span>{t("review.kb.page")} {result.metadata.page}</span>
                      )}
                    </div>
                    {result.location && (
                      <button
                        onClick={() => window.open(result.location, "_blank")}
                        className="flex items-center gap-1 text-xs text-aws-font-color-blue hover:underline"
                      >
                        {t("review.kb.viewDocument")}
                        <HiExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
