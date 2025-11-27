import { FastifyRequest, FastifyReply } from "fastify";
import {
  getUserPreference,
  updateLanguage,
  UpdateLanguageRequest,
} from "../usecase/preference";

export const getUserPreferenceHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const userId = request.user?.sub;

  if (!userId) {
    return reply.code(401).send({
      success: false,
      error: {
        message: "Authentication required",
      },
    });
  }

  try {
    const preference = await getUserPreference({ userId });

    reply.code(200).send({
      success: true,
      data: preference,
    });
  } catch (error) {
    console.error("Error getting user preference:", error);
    reply.code(500).send({
      success: false,
      error: {
        message: "Failed to get user preference",
      },
    });
  }
};

export const updateLanguageHandler = async (
  request: FastifyRequest<{ Body: UpdateLanguageRequest }>,
  reply: FastifyReply
): Promise<void> => {
  const userId = request.user?.sub;

  if (!userId) {
    return reply.code(401).send({
      success: false,
      error: {
        message: "Authentication required",
      },
    });
  }

  try {
    const updatedPreference = await updateLanguage({
      userId,
      request: request.body,
    });

    reply.code(200).send({
      success: true,
      data: updatedPreference,
    });
  } catch (error) {
    console.error("Error updating language preference:", error);
    reply.code(500).send({
      success: false,
      error: {
        message: "Failed to update language preference",
      },
    });
  }
};
