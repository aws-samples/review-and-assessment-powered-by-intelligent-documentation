import { PrismaClient, getPrismaClient, Prisma } from "../../../core/db";
import { NotFoundError } from "../../../core/errors";
import { ToolConfigurationEntity } from "./model/tool-configuration";

export interface ToolConfigurationRepository {
  create(config: ToolConfigurationEntity): Promise<void>;
  findAll(): Promise<ToolConfigurationEntity[]>;
  findById(id: string): Promise<ToolConfigurationEntity>;
  delete(id: string): Promise<void>;
  isUsedByCheckLists(id: string): Promise<boolean>;
}

export const makePrismaToolConfigurationRepository = async (
  clientInput: PrismaClient | null = null
): Promise<ToolConfigurationRepository> => {
  const client = clientInput || (await getPrismaClient());

  const create = async (config: ToolConfigurationEntity): Promise<void> => {
    await client.toolConfiguration.create({
      data: {
        id: config.id,
        name: config.name,
        description: config.description,
        knowledgeBase: config.knowledgeBase
          ? (config.knowledgeBase as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        codeInterpreter: config.codeInterpreter,
        mcpConfig: config.mcpConfig
          ? (config.mcpConfig as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  };

  const findAll = async (): Promise<ToolConfigurationEntity[]> => {
    const configs = await client.toolConfiguration.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { checkLists: true },
        },
      },
    });

    return configs.map((config) => ({
      id: config.id,
      name: config.name,
      description: config.description || undefined,
      knowledgeBase: config.knowledgeBase
        ? (config.knowledgeBase as any)
        : undefined,
      codeInterpreter: config.codeInterpreter,
      mcpConfig: config.mcpConfig ? (config.mcpConfig as any) : undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      usageCount: (config as any)._count.checkLists,
    }));
  };

  const findById = async (id: string): Promise<ToolConfigurationEntity> => {
    const config = await client.toolConfiguration.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundError("Tool configuration not found", id);
    }

    return {
      id: config.id,
      name: config.name,
      description: config.description || undefined,
      knowledgeBase: config.knowledgeBase
        ? (config.knowledgeBase as any)
        : undefined,
      codeInterpreter: config.codeInterpreter,
      mcpConfig: config.mcpConfig ? (config.mcpConfig as any) : undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  };

  const deleteConfig = async (id: string): Promise<void> => {
    await client.toolConfiguration.delete({
      where: { id },
    });
  };

  const isUsedByCheckLists = async (id: string): Promise<boolean> => {
    const count = await client.checkList.count({
      where: { toolConfigurationId: id },
    });
    return count > 0;
  };

  return {
    create,
    findAll,
    findById,
    delete: deleteConfig,
    isUsedByCheckLists,
  };
};
