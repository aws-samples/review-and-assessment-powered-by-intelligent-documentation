import { ulid } from "ulid";

export interface UserPreferenceModel {
  id: string;
  userId: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

export const UserPreferenceDomain = {
  create: (userId: string, language: string): UserPreferenceModel => {
    return {
      id: ulid(),
      userId,
      language,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  update: (
    existing: UserPreferenceModel,
    language?: string
  ): UserPreferenceModel => {
    return {
      ...existing,
      language: language !== undefined ? language : existing.language,
      updatedAt: new Date(),
    };
  },

  updateLanguage: (
    current: UserPreferenceModel,
    language: string
  ): UserPreferenceModel => {
    return {
      ...current,
      language,
      updatedAt: new Date(),
    };
  },

  getDefault: (userId: string): UserPreferenceModel => {
    return {
      id: "",
      userId,
      language: "en",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },
};
