export interface KnowledgeBaseConfig {
  knowledgeBaseId: string;
  dataSourceIds?: string[];
}

export interface ToolConfiguration {
  id: string;
  name: string;
  description?: string;
  knowledgeBase?: KnowledgeBaseConfig[];
  codeInterpreter: boolean;
  mcpConfig?: any;
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
}

export interface CreateToolConfigurationRequest {
  name: string;
  description?: string;
  knowledgeBase?: KnowledgeBaseConfig[];
  codeInterpreter: boolean;
  mcpConfig?: any;
}
