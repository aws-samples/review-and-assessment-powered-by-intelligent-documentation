import { ulid } from "ulid";

export interface KnowledgeBaseConfig {
  knowledgeBaseId: string;
  dataSourceIds?: string[];
}

export interface ToolConfigurationEntity {
  id: string;
  name: string;
  description?: string;
  knowledgeBase?: KnowledgeBaseConfig[];
  codeInterpreter: boolean;
  mcpConfig?: any;
  createdAt: Date;
  updatedAt: Date;
}

export const ToolConfigurationDomain = {
  fromCreateRequest: (req: {
    name: string;
    description?: string;
    knowledgeBase?: KnowledgeBaseConfig[];
    codeInterpreter: boolean;
    mcpConfig?: any;
  }): ToolConfigurationEntity => {
    return {
      id: ulid(),
      name: req.name,
      description: req.description,
      knowledgeBase: req.knowledgeBase,
      codeInterpreter: req.codeInterpreter,
      mcpConfig: req.mcpConfig,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },
};
