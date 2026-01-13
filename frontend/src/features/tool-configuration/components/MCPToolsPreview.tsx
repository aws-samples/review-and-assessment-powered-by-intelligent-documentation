import { PreviewToolsResult } from "../types";
import { HiCheck, HiX } from "react-icons/hi";

interface MCPToolsPreviewProps {
  results: PreviewToolsResult[];
}

export default function MCPToolsPreview({ results }: MCPToolsPreviewProps) {
  return (
    <div className="mt-4 space-y-4">
      {results.map((result) => (
        <div
          key={result.serverName}
          className="rounded-lg border border-light-gray bg-white p-4 dark:border-aws-squid-ink-dark dark:bg-aws-squid-ink-darkest"
        >
          <div className="mb-2 flex items-center gap-2">
            <h4 className="font-semibold text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
              {result.serverName}
            </h4>
            {result.status === "success" ? (
              <HiCheck className="h-5 w-5 text-green-500" />
            ) : (
              <HiX className="h-5 w-5 text-red-500" />
            )}
          </div>

          {result.status === "success" ? (
            <div className="space-y-2">
              <p className="text-sm text-aws-font-color-gray dark:text-aws-font-color-gray-dark">
                {result.tools?.length || 0} tools available
              </p>
              <ul className="space-y-1 text-sm">
                {result.tools?.map((tool) => (
                  <li
                    key={tool.name}
                    className="text-aws-squid-ink-light dark:text-aws-font-color-white-dark"
                  >
                    <span className="font-medium">{tool.name}</span>
                    {tool.description && (
                      <span className="text-aws-font-color-gray dark:text-aws-font-color-gray-dark">
                        {" - "}
                        {tool.description}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-red">{result.error}</p>
          )}
        </div>
      ))}
    </div>
  );
}
