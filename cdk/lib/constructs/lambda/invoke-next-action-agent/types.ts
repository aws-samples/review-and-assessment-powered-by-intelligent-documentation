export interface StepFunctionsInput {
  reviewJobId: string;
  preGenerateResult: {
    Payload: {
      shouldGenerate: boolean;
      promptTemplate: {
        prompt: string;
        toolConfigurationId?: string;
      };
      templateData: TemplateData;
      toolConfiguration?: ToolConfiguration;
    };
  };
}

export interface TemplateData {
  checklistName: string;
  passCount: number;
  failCount: number;
  failedItems: FailedItem[];
  userOverrides: UserOverride[];
  allResults: ReviewResult[];
  documents: DocumentInfo[];
}

export interface FailedItem {
  checkList: {
    name: string;
    description?: string;
  };
  result: string;
  explanation?: string;
  extractedText?: string;
  confidenceScore?: number;
}

export interface UserOverride {
  checkList: {
    name: string;
  };
  result: string;
  userComment?: string;
}

export interface ReviewResult {
  checkList: {
    name: string;
  };
  result: string;
  userOverride?: boolean;
}

export interface DocumentInfo {
  filename: string;
}

export interface ToolConfiguration {
  id: string;
  name: string;
  knowledgeBases?: KnowledgeBaseConfig[];
  enableCodeInterpreter?: boolean;
  mcpServers?: McpServerConfig[];
}

export interface KnowledgeBaseConfig {
  knowledgeBaseId: string;
  description?: string;
}

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface AgentPayload {
  reviewJobId: string;
  promptTemplate: {
    prompt: string;
  };
  templateData: TemplateData;
  toolConfiguration?: ToolConfiguration;
}
