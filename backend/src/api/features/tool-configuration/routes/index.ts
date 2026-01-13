import { FastifyInstance } from "fastify";
import {
  getAllToolConfigurationsHandler,
  getToolConfigurationByIdHandler,
  createToolConfigurationHandler,
  deleteToolConfigurationHandler,
  previewMcpToolsHandler,
} from "./handlers";

export function registerToolConfigurationRoutes(
  fastify: FastifyInstance
): void {
  fastify.get("/tool-configurations", {
    handler: getAllToolConfigurationsHandler,
  });

  fastify.get("/tool-configurations/:id", {
    handler: getToolConfigurationByIdHandler,
  });

  fastify.post("/tool-configurations", {
    handler: createToolConfigurationHandler,
  });

  fastify.delete("/tool-configurations/:id", {
    handler: deleteToolConfigurationHandler,
  });

  fastify.post("/tool-configurations/preview-tools", {
    handler: previewMcpToolsHandler,
  });
}
