import { ApiResponse } from "../../types/api";

export interface UserPreference {
  id: string;
  userId: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateLanguageRequest {
  language: string;
}

export type GetUserPreferenceResponse = ApiResponse<UserPreference>;
export type UpdateLanguageResponse = ApiResponse<UserPreference>;
