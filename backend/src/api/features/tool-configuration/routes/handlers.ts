import { FastifyRequest, FastifyReply } from "fastify";
import {
  createToolConfiguration,
  getAllToolConfigurations,
  getToolConfigurationById,
  deleteToolConfiguration,
} from "../usecase/tool-configuration";
import { KnowledgeBaseConfig } from "../domain/model/tool-configuration";
import { previewMcpTools } from "../domain/service/mcp-tools-service";

export interface CreateToolConfigurationRequest {
  name: string;
  description?: string;
  knowledgeBase?: KnowledgeBaseConfig[];
  codeInterpreter: boolean;
  mcpConfig?: any;
}

export const getAllToolConfigurationsHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const configs = await getAllToolConfigurations({});
  reply.code(200).send({ success: true, data: configs });
};

export const getToolConfigurationByIdHandler = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  const config = await getToolConfigurationById({
    id: request.params.id,
  });
  reply.code(200).send({ success: true, data: config });
};

export const createToolConfigurationHandler = async (
  request: FastifyRequest<{ Body: CreateToolConfigurationRequest }>,
  reply: FastifyReply
): Promise<void> => {
  const config = await createToolConfiguration({
    request: request.body,
  });
  reply.code(201).send({ success: true, data: config });
};

export const deleteToolConfigurationHandler = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  await deleteToolConfiguration({ id: request.params.id });
  reply.code(200).send({ success: true });
};

export const previewMcpToolsHandler = async (
  request: FastifyRequest<{ Body: { mcpConfig: any } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const results = await previewMcpTools(request.body.mcpConfig);
    reply.code(200).send({ success: true, data: results });
  } catch (error) {
    reply.code(500).send({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
