import {
  ToolConfigurationEntity,
  ToolConfigurationDomain,
  KnowledgeBaseConfig,
} from "../domain/model/tool-configuration";
import {
  ToolConfigurationRepository,
  makePrismaToolConfigurationRepository,
} from "../domain/repository";
import { ApplicationError } from "../../../core/errors";

export const createToolConfiguration = async (params: {
  request: {
    name: string;
    description?: string;
    knowledgeBase?: KnowledgeBaseConfig[];
    codeInterpreter: boolean;
    mcpConfig?: any;
  };
  deps?: {
    repo?: ToolConfigurationRepository;
  };
}): Promise<ToolConfigurationEntity> => {
  const repo =
    params.deps?.repo || (await makePrismaToolConfigurationRepository());
  const config = ToolConfigurationDomain.fromCreateRequest(params.request);
  await repo.create(config);
  return config;
};

export const getAllToolConfigurations = async (params: {
  deps?: {
    repo?: ToolConfigurationRepository;
  };
}): Promise<ToolConfigurationEntity[]> => {
  const repo =
    params.deps?.repo || (await makePrismaToolConfigurationRepository());
  return repo.findAll();
};

export const getToolConfigurationById = async (params: {
  id: string;
  deps?: {
    repo?: ToolConfigurationRepository;
  };
}): Promise<ToolConfigurationEntity> => {
  const repo =
    params.deps?.repo || (await makePrismaToolConfigurationRepository());
  return repo.findById(params.id);
};

export const deleteToolConfiguration = async (params: {
  id: string;
  deps?: {
    repo?: ToolConfigurationRepository;
  };
}): Promise<void> => {
  const repo =
    params.deps?.repo || (await makePrismaToolConfigurationRepository());

  const isUsed = await repo.isUsedByCheckLists(params.id);
  if (isUsed) {
    throw new ApplicationError(
      "Cannot delete tool configuration that is in use by checklist items"
    );
  }

  await repo.delete(params.id);
};
