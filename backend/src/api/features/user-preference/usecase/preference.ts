import {
  UserPreferenceModel,
  UserPreferenceDomain,
} from "../domain/model/preference";
import {
  UserPreferenceRepository,
  makePrismaUserPreferenceRepository,
} from "../domain/repository";

export const getUserPreference = async (params: {
  userId: string;
  deps?: {
    repo?: UserPreferenceRepository;
  };
}): Promise<UserPreferenceModel> => {
  const repo =
    params.deps?.repo || (await makePrismaUserPreferenceRepository());
  const preference = await repo.getUserPreference(params.userId);

  if (!preference) {
    return UserPreferenceDomain.getDefault(params.userId);
  }

  return preference;
};

export interface UpdateLanguageRequest {
  language: string;
}

export const updateLanguage = async (params: {
  userId: string;
  request: UpdateLanguageRequest;
  deps?: {
    repo?: UserPreferenceRepository;
  };
}): Promise<UserPreferenceModel> => {
  const repo =
    params.deps?.repo || (await makePrismaUserPreferenceRepository());

  const existing = await repo.getUserPreference(params.userId);

  if (!existing) {
    const newPreference = UserPreferenceDomain.create(
      params.userId,
      params.request.language
    );
    await repo.saveUserPreference(newPreference);
    return newPreference;
  }

  const updatedPreference = UserPreferenceDomain.updateLanguage(
    existing,
    params.request.language
  );
  await repo.updateUserPreference(updatedPreference);
  return updatedPreference;
};
