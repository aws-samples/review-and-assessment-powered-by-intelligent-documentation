/**
 * 利用可能なモデル一覧
 *
 * parameter.ts の availableModels で設定されたモデルのみが
 * 環境変数 AVAILABLE_MODELS 経由で渡される。
 */

export interface ModelInfo {
  modelId: string;
  displayName: string;
}

/**
 * 環境変数から利用可能なモデル一覧を取得する
 */
export const getAvailableModels = (): ModelInfo[] => {
  const raw = process.env.AVAILABLE_MODELS;
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (m: any) =>
        typeof m.modelId === "string" &&
        typeof m.displayName === "string" &&
        m.modelId.length > 0 &&
        m.displayName.length > 0
    );
  } catch {
    return [];
  }
};
