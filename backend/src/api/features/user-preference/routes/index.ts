import { FastifyInstance } from "fastify";
import { getUserPreferenceHandler, updateLanguageHandler } from "./handlers";

export function registerUserPreferenceRoutes(fastify: FastifyInstance): void {
  fastify.get("/user/preference", {
    handler: getUserPreferenceHandler,
  });

  fastify.put("/user/preference/language", {
    handler: updateLanguageHandler,
  });
}
