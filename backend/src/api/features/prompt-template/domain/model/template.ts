import { ulid } from "ulid";

export enum PromptTemplateType {
  CHECKLIST = "checklist",
  REVIEW = "review",
  NEXT_ACTION = "next_action",
}

export interface PromptTemplateEntity {
  id: string;
  userId: string;
  name: string;
  description?: string;
  prompt: string;
  type: PromptTemplateType;
  createdAt: Date;
  updatedAt: Date;
}

export const PromptTemplateDomain = {
  fromCreateRequest: (req: {
    userId: string;
    name: string;
    description?: string;
    prompt: string;
    type: PromptTemplateType;
  }): PromptTemplateEntity => {
    return {
      id: ulid(),
      userId: req.userId,
      name: req.name,
      description: req.description,
      prompt: req.prompt,
      type: req.type,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  fromUpdateRequest: (
    existing: PromptTemplateEntity,
    req: {
      name?: string;
      description?: string;
      prompt?: string;
    }
  ): PromptTemplateEntity => {
    return {
      ...existing,
      name: req.name !== undefined ? req.name : existing.name,
      description:
        req.description !== undefined ? req.description : existing.description,
      prompt: req.prompt !== undefined ? req.prompt : existing.prompt,
      updatedAt: new Date(),
    };
  },
};
