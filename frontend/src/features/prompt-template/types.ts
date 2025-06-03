import { ApiResponse } from "../../types/api";

export enum PromptTemplateType {
  CHECKLIST = "checklist",
  REVIEW = "review",
}

export interface PromptTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  prompt: string;
  type: PromptTemplateType;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePromptTemplateRequest {
  name: string;
  description?: string;
  prompt: string;
  type: PromptTemplateType;
}

export interface UpdatePromptTemplateRequest {
  name?: string;
  description?: string;
  prompt?: string;
}

export type GetPromptTemplatesResponse = ApiResponse<{
  templates: PromptTemplate[];
}>;

export type GetPromptTemplateResponse = ApiResponse<{
  template: PromptTemplate;
}>;

export type CreatePromptTemplateResponse = ApiResponse<{
  template: PromptTemplate;
}>;

export type UpdatePromptTemplateResponse = ApiResponse<{
  template: PromptTemplate;
}>;

export type DeletePromptTemplateResponse = ApiResponse<Record<string, never>>;
