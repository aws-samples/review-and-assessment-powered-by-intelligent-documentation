// API通信用 (バックエンドと一致)
export interface KnowledgeBaseConfig {
  knowledgeBaseId: string;
  dataSourceIds?: string[];
}

// フロントエンド内部のUI状態管理用
export interface KnowledgeBaseConfigUI extends KnowledgeBaseConfig {
  dataSourceIdsRaw: string;
}

// MCP Server Configuration Types (Claude Code形式)
export interface MCPServerConfig {
  // stdio必須フィールド
  command?: string;
  args?: string[];

  // HTTP必須フィールド
  url?: string;

  // オプショナルフィールド
  headers?: Record<string, string>;
  oauthScopes?: string[];
  env?: Record<string, string>;
  timeout?: number;
  disabled?: boolean;
  disabledTools?: string[];
}

// オブジェクト形式：{"server-name": {...}}
export type MCPServers = Record<string, MCPServerConfig>;

export interface ToolConfiguration {
  id: string;
  name: string;
  description?: string;
  knowledgeBase?: KnowledgeBaseConfig[];
  codeInterpreter: boolean;
  mcpConfig?: MCPServers; // Record<string, MCPServerConfig>
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
}

export interface CreateToolConfigurationRequest {
  name: string;
  description?: string;
  knowledgeBase?: KnowledgeBaseConfig[];
  codeInterpreter: boolean;
  mcpConfig?: MCPServers; // Record<string, MCPServerConfig>
}

export interface PreviewToolsResult {
  serverName: string;
  status: "success" | "error";
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: any;
  }>;
  error?: string;
}
