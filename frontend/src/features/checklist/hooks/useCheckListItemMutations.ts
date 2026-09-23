// hooks/useCheckListItemMutations.ts
import { useApiClient } from "../../../hooks/useApiClient";
import { mutate } from "swr";
import type {
  CreateChecklistItemRequest,
  CreateChecklistItemResponse,
  UpdateChecklistItemRequest,
  UpdateChecklistItemResponse,
  DeleteChecklistItemResponse,
  UpdateChecklistItemModelRequest,
  UpdateChecklistItemModelResponse,
  UpdateChecklistItemImportanceRequest,
  UpdateChecklistItemImportanceResponse,
  CHECK_ITEM_IMPORTANCE,
} from "../types";

/**
 * チェックリスト項目の作成
 */
export function useCreateCheckListItem(setId: string) {
  const { mutateAsync, status, error } = useApiClient().useMutation<
    CreateChecklistItemResponse,
    CreateChecklistItemRequest
  >("post", `/checklist-sets/${setId}/items`);

  const createCheckListItem = async (body: CreateChecklistItemRequest) => {
    const res = await mutateAsync(body);
    // キャッシュ更新
    mutate(
      (key) =>
        typeof key === "string" &&
        key.startsWith(`/checklist-sets/${setId}/items`)
    );
    return res;
  };

  return { createCheckListItem, status, error };
}

/**
 * チェックリスト項目の更新
 */
export function useUpdateCheckListItem(setId: string) {
  const { mutateAsync, status, error } = useApiClient().useMutation<
    UpdateChecklistItemResponse,
    UpdateChecklistItemRequest
  >("put", `/checklist-sets/${setId}/items`);

  const updateCheckListItem = async (
    itemId: string,
    body: UpdateChecklistItemRequest
  ) => {
    const res = await mutateAsync(
      body,
      `/checklist-sets/${setId}/items/${itemId}`
    );
    // キャッシュ更新
    mutate(
      (key) =>
        typeof key === "string" &&
        key.startsWith(`/checklist-sets/${setId}/items`)
    );
    return res;
  };

  return { updateCheckListItem, status, error };
}

/**
 * チェックリスト項目の削除
 */
export function useDeleteCheckListItem(setId: string) {
  const { mutateAsync, status, error } = useApiClient().useMutation<
    DeleteChecklistItemResponse,
    void
  >("delete", `/checklist-sets/${setId}/items`);

  const deleteCheckListItem = async (itemId: string) => {
    const res = await mutateAsync(
      undefined,
      `/checklist-sets/${setId}/items/${itemId}`
    );
    // キャッシュ更新
    mutate(
      (key) =>
        typeof key === "string" &&
        key.startsWith(`/checklist-sets/${setId}/items`)
    );
    return res;
  };

  return { deleteCheckListItem, status, error };
}

/**
 * 一括ツール設定の割り当て
 */
export function useBulkAssignToolConfiguration() {
  const { mutateAsync, status, error } = useApiClient().useMutation<
    { success: boolean; updatedCount: number },
    { checkIds: string[]; toolConfigurationId: string | null }
  >("patch", "/checklist-items/bulk/tool-configuration");

  const bulkAssignToolConfiguration = async (
    checkIds: string[],
    toolConfigurationId: string | null
  ) => {
    const res = await mutateAsync(
      { checkIds, toolConfigurationId },
      "/checklist-items/bulk/tool-configuration"
    );
    mutate(
      (key) =>
        typeof key === "string" &&
        key.startsWith("/checklist-sets/") &&
        key.includes("/items")
    );
    return res;
  };

  return { bulkAssignToolConfiguration, status, error };
}

/**
 * チェックリスト項目のモデル ID 更新
 */
export function useUpdateCheckListItemModel(setId: string) {
  const { mutateAsync, status, error } = useApiClient().useMutation<
    UpdateChecklistItemModelResponse,
    UpdateChecklistItemModelRequest
  >("patch", `/checklist-sets/${setId}/items`);

  const updateCheckListItemModel = async (
    itemId: string,
    modelId: string | null
  ) => {
    const res = await mutateAsync(
      { modelId },
      `/checklist-sets/${setId}/items/${itemId}/model`
    );
    mutate(
      (key) =>
        typeof key === "string" &&
        key.startsWith(`/checklist-sets/${setId}/items`)
    );
    return res;
  };

  return { updateCheckListItemModel, status, error };
}

/**
 * チェックリスト項目の重要度更新
 */
export function useUpdateCheckListItemImportance(setId: string) {
  const { mutateAsync, status, error } = useApiClient().useMutation<
    UpdateChecklistItemImportanceResponse,
    UpdateChecklistItemImportanceRequest
  >("patch", `/checklist-sets/${setId}/items`);

  const updateCheckListItemImportance = async (
    itemId: string,
    importance: CHECK_ITEM_IMPORTANCE
  ) => {
    const res = await mutateAsync(
      { importance },
      `/checklist-sets/${setId}/items/${itemId}/importance`
    );
    mutate(
      (key) =>
        typeof key === "string" &&
        key.startsWith(`/checklist-sets/${setId}/items`)
    );
    return res;
  };

  return { updateCheckListItemImportance, status, error };
}
