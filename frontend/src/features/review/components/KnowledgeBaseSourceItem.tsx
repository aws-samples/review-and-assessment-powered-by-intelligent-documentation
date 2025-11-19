import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronDown, HiChevronRight, HiCheckCircle, HiDocumentText, HiExternalLink } from "react-icons/hi";
import Button from "../../../components/Button";

interface KBResult {
  text: string;
  score?: number;
  location?: string;
  metadata?: {
    "x-amz-bedrock-kb-source-uri"?: string;
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

  const parseOutput = () => {
    if (!source.output) return null;
    try {
      const parsed = JSON.parse(source.output);
      
      // Try multiple possible formats
      // Format 1: {content: [{json: {query, results}}]}
      if (parsed.content && Array.isArray(parsed.content)) {
        const jsonContent = parsed.content.find((c: any) => c.json);
        if (jsonContent?.json) {
          return {
            query: jsonContent.json.query || "",
            results: jsonContent.json.results || [],
          };
        }
      }
      
      // Format 2: Direct {query, results}
      if (parsed.query !== undefined || parsed.results !== undefined) {
        return {
          query: parsed.query || "",
          results: parsed.results || [],
        };
      }
      
      // Format 3: {json: {query, results}}
      if (parsed.json) {
        return {
          query: parsed.json.query || "",
          results: parsed.json.results || [],
        };
      }
      
      return null;
    } catch {
      return null;
    }
  };
  
  const parseInput = () => {
    if (!source.input) return "";
    if (typeof source.input === "object") {
      return source.input.query || source.input.searchQuery || JSON.stringify(source.input);
    }
    return String(source.input);
  };

  const getDocumentName = (location?: string) => {
    if (!location) return "Document";
    const parts = location.split("/");
    return parts[parts.length - 1] || "Document";
  };

  const handleViewDocument = (location?: string) => {
    if (!location) return;
    // TODO: Call presigned URL API endpoint
    window.open(location, "_blank");
  };

  const data = parseOutput();
  const inputQuery = parseInput();

  return (
    <div className="mt-1 rounded border border-light-gray bg-aws-paper-light p-2 text-xs">
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

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Input Display */}
          {inputQuery && (
            <div className="bg-white rounded p-2 border border-gray-200">
              <span className="text-gray-600 font-medium">{t("review.kb.searchKeywords")}:</span>
              <span className="ml-2 text-aws-squid-ink-light">{inputQuery}</span>
            </div>
          )}

          {/* Output Display */}
          {data ? (
            <div>
              <div className="text-gray-600 font-medium mb-2">{t("review.kb.results")} ({data.results.length})</div>
              <div className="space-y-2">
                {data.results.map((result: KBResult, idx: number) => (
                  <div key={idx} className="bg-white rounded border border-gray-200 p-3">
                    <div className="text-sm text-aws-squid-ink-light mb-2 leading-relaxed">{result.text}</div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <HiDocumentText className="h-3 w-3" />
                          <span>{getDocumentName(result.location)}</span>
                        </div>
                        {result.metadata?.page && (
                          <span>
                            {t("review.kb.page")} {result.metadata.page}
                          </span>
                        )}
                        {result.score && (
                          <span className="text-blue-600">⭐ {result.score.toFixed(2)}</span>
                        )}
                      </div>
                      {result.location && (
                        <button
                          onClick={() => handleViewDocument(result.location)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
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
          ) : (
            <div className="bg-white rounded p-2 border border-gray-200">
              <div className="text-gray-600 font-medium mb-1">{t("review.output")}:</div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap">{source.output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
