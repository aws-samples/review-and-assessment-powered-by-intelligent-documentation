import { PrismaClient, getPrismaClient } from "../../../core/db";
import { NotFoundError } from "../../../core/errors";
import { PromptTemplateEntity, PromptTemplateType } from "./model/template";

export interface PromptTemplateRepository {
  getPromptTemplates(
    userId: string,
    type: PromptTemplateType
  ): Promise<PromptTemplateEntity[]>;
  getPromptTemplateById(id: string): Promise<PromptTemplateEntity>;
  createPromptTemplate(template: PromptTemplateEntity): Promise<void>;
  updatePromptTemplate(template: PromptTemplateEntity): Promise<void>;
  deletePromptTemplate(id: string): Promise<void>;
}

export const makePrismaPromptTemplateRepository = async (
  clientInput: PrismaClient | null = null
): Promise<PromptTemplateRepository> => {
  const client = clientInput || (await getPrismaClient());

  const getPromptTemplates = async (
    userId: string,
    type: PromptTemplateType
  ): Promise<PromptTemplateEntity[]> => {
    const templates = await client.promptTemplate.findMany({
      where: {
        userId,
        type,
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    return templates.map((template) => ({
      id: template.id,
      userId: template.userId,
      name: template.name,
      description: template.description || undefined,
      prompt: template.prompt,
      type: template.type as PromptTemplateType,
      toolConfigurationId: template.toolConfigurationId || undefined,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    }));
  };

  const getPromptTemplateById = async (
    id: string
  ): Promise<PromptTemplateEntity> => {
    const template = await client.promptTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundError("Prompt template not found", id);
    }

    return {
      id: template.id,
      userId: template.userId,
      name: template.name,
      description: template.description || undefined,
      prompt: template.prompt,
      type: template.type as PromptTemplateType,
      toolConfigurationId: template.toolConfigurationId || undefined,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  };

  const createPromptTemplate = async (
    template: PromptTemplateEntity
  ): Promise<void> => {
    // 新しいテンプレートを作成
    await client.promptTemplate.create({
      data: {
        id: template.id,
        userId: template.userId,
        name: template.name,
        description: template.description,
        prompt: template.prompt,
        type: template.type,
        toolConfigurationId: template.toolConfigurationId,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      },
    });
  };

  const updatePromptTemplate = async (
    template: PromptTemplateEntity
  ): Promise<void> => {
    // テンプレートを更新
    await client.promptTemplate.update({
      where: { id: template.id },
      data: {
        name: template.name,
        description: template.description,
        prompt: template.prompt,
        toolConfigurationId: template.toolConfigurationId ?? null,
        updatedAt: template.updatedAt,
      },
    });
  };

  const deletePromptTemplate = async (id: string): Promise<void> => {
    await client.promptTemplate.delete({
      where: { id },
    });
  };

  return {
    getPromptTemplates,
    getPromptTemplateById,
    createPromptTemplate,
    updatePromptTemplate,
    deletePromptTemplate,
  };
};
