import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronDown, HiChevronRight, HiCheckCircle, HiDocumentText, HiExternalLink } from "react-icons/hi";
import Button from "../../../components/Button";
import Tooltip from "../../../components/Tooltip";
import { usePresignedDownloadUrl } from "../../../hooks/usePresignedDownloadUrl";
import { parseS3Uri } from "../../../utils/s3";

interface KBResult {
  text: string;
  location?: string;
  locationType?: "S3" | "URL" | "OTHER";
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
  const [documentUrls, setDocumentUrls] = useState<Map<number, string>>(new Map());
  const [loadingUrls, setLoadingUrls] = useState<Set<number>>(new Set());
  const { getPresignedUrl } = usePresignedDownloadUrl();

  const data = source.output ? JSON.parse(source.output) : null;
  const query = source.input?.query || "";

  useEffect(() => {
    if (!isExpanded || !data?.results) return;

    const fetchS3Urls = async () => {
      const urlMap = new Map<number, string>();
      const loading = new Set<number>();

      for (let idx = 0; idx < data.results.length; idx++) {
        const result = data.results[idx];

        if (result.locationType === "S3" && result.location) {
          const parsed = parseS3Uri(result.location);
          if (parsed) {
            loading.add(idx);
            setLoadingUrls(new Set(loading));
            try {
              const presignedUrl = await getPresignedUrl(parsed.key);
              const finalUrl = result.metadata?.page
                ? `${presignedUrl}#page=${result.metadata.page}`
                : presignedUrl;
              urlMap.set(idx, finalUrl);
            } catch (error) {
              console.error(`Failed to get presigned URL for ${result.location}:`, error);
            } finally {
              loading.delete(idx);
            }
          }
        } else if (result.locationType === "URL" && result.location) {
          urlMap.set(idx, result.location);
        }
      }

      setDocumentUrls(urlMap);
      setLoadingUrls(new Set(loading));
    };

    fetchS3Urls();
  }, [isExpanded, data]);

  const handleViewDocument = (idx: number, result: KBResult) => {
    const url = documentUrls.get(idx);

    if (!url) {
      console.warn("Document URL not available");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const getDocumentName = (location?: string) => {
    if (!location) return t("review.sources.knowledgeBase.document");
    return location.split("/").pop() || t("review.sources.knowledgeBase.document");
  };

  return (
    <div className="rounded border border-light-gray bg-aws-paper-light p-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HiCheckCircle className="h-4 w-4 text-green-600" />
          <div className="flex items-center gap-1">
            <span className="font-medium text-aws-squid-ink-light">
              {t("review.sources.knowledgeBase.title")}
            </span>
            <Tooltip content={t("review.sources.knowledgeBase.tooltip")} position="top">
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

      {isExpanded && data && (
        <div className="mt-3 space-y-3">
          {query && (
            <div>
              <p className="mb-1 font-medium text-aws-squid-ink-light">
                {t("review.sources.knowledgeBase.searchKeywords")}:
              </p>
              <p className="text-aws-font-color-gray">{query}</p>
            </div>
          )}

          <div>
            <p className="mb-2 font-medium text-aws-squid-ink-light">
              {t("review.sources.knowledgeBase.results")} ({data.results?.length || 0})
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
                        <span>
                          {t("review.sources.knowledgeBase.page")} {result.metadata.page}
                        </span>
                      )}
                    </div>
                    {result.location && (result.locationType === "S3" || result.locationType === "URL") && (
                      <button
                        onClick={() => handleViewDocument(idx, result)}
                        disabled={loadingUrls.has(idx)}
                        className="flex items-center gap-1 text-xs text-aws-font-color-blue hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingUrls.has(idx) ? (
                          <>
                            <span className="inline-block w-3 h-3 border-2 border-aws-font-color-blue border-t-transparent rounded-full animate-spin" />
                            {t("review.sources.knowledgeBase.loading")}
                          </>
                        ) : (
                          <>
                            {t("review.sources.knowledgeBase.viewDocument")}
                            <HiExternalLink className="h-3 w-3" />
                          </>
                        )}
                      </button>
                    )}
                    {result.location && result.locationType === "OTHER" && (
                      <span className="text-xs text-aws-font-color-tertiary">
                        {result.location}
                      </span>
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
