import CodeInterpreterSourceItem from "./CodeInterpreterSourceItem";
import KnowledgeBaseSourceItem from "./KnowledgeBaseSourceItem";
import GenericSourceItem from "./GenericSourceItem";

interface ExternalSourceItemProps {
  source: {
    toolUseId: string;
    toolName: string;
    input?: any;
    output?: string;
    status?: "success" | "error" | "unknown";
  };
}

export default function ExternalSourceItem({ source }: ExternalSourceItemProps) {
  const toolName = source.toolName.toLowerCase();

  if (toolName === "code_interpreter") {
    return <CodeInterpreterSourceItem source={source} />;
  }

  if (toolName === "knowledge_base_query") {
    return <KnowledgeBaseSourceItem source={source} />;
  }

  return <GenericSourceItem source={source} />;
}
