// API通信用 (バックエンドと一致)
export interface KnowledgeBaseConfig {
  knowledgeBaseId: string;
  dataSourceIds?: string[];
}

// フロントエンド内部のUI状態管理用
export interface KnowledgeBaseConfigUI extends KnowledgeBaseConfig {
  dataSourceIdsRaw: string;
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
