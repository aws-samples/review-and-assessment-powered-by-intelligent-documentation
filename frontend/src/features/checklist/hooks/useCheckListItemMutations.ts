// hooks/useCheckListItemMutations.ts
import { useApiClient } from "../../../hooks/useApiClient";
import { mutate } from "swr";
import type {
  CreateChecklistItemRequest,
  CreateChecklistItemResponse,
  UpdateChecklistItemRequest,
  UpdateChecklistItemResponse,
  DeleteChecklistItemResponse,
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
    mutate(`/checklist-sets/${setId}/items/hierarchy`);
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
    mutate(`/checklist-sets/${setId}/items/hierarchy`);
    mutate(`/checklist-sets/${setId}/items/${itemId}`);
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
    mutate(`/checklist-sets/${setId}/items/hierarchy`);
    return res;
  };

  return { deleteCheckListItem, status, error };
}

/**
 * ツール設定の割り当て
 */
export function useAssignToolConfiguration() {
  const { mutateAsync, status, error } = useApiClient().useMutation<
    { success: boolean },
    { toolConfigurationId: string | null }
  >("patch", "/checklist-items");

  const assignToolConfiguration = async (
    checkId: string,
    toolConfigurationId: string | null
  ) => {
    const res = await mutateAsync(
      { toolConfigurationId },
      `/checklist-items/${checkId}/tool-configuration`
    );
    // キャッシュ更新
    mutate(
      (key) => typeof key === "string" && key.includes("/items/hierarchy")
    );
    return res;
  };

  return { assignToolConfiguration, status, error };
}
