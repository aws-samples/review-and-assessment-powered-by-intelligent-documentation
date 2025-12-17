export interface StepFunctionsInput {
  reviewJobId: string;
  checkId: string;
  reviewResultId: string;
  preItemResult: {
    Payload: {
      checkName: string;
      checkDescription: string;
      languageName: string;
      documentPaths: string[];
      documentIds: string[];
      mcpServers: McpServerConfig[];
      toolConfiguration: any;
    };
  };
}

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface AgentPayload {
  reviewJobId: string;
  checkId: string;
  reviewResultId: string;
  documentPaths: string[];
  checkName: string;
  checkDescription: string;
  languageName: string;
  mcpServers: McpServerConfig[];
  toolConfiguration: any;
}
