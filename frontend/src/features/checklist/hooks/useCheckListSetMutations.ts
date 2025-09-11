import { useApiClient } from "../../../hooks/useApiClient";
import { mutate } from "swr";
import type {
  CreateChecklistSetRequest,
  CreateChecklistSetResponse,
  DuplicateChecklistSetRequest,
  DuplicateChecklistSetResponse,
  DetectAmbiguityResponse,
} from "../types";

export function useCreateChecklistSet() {
  const { mutateAsync, status, error } = useApiClient().useMutation<
    CreateChecklistSetResponse,
    CreateChecklistSetRequest
  >("post", "/checklist-sets");

  return { createChecklistSet: mutateAsync, status, error };
}

export function useUpdateChecklistSet() {
  const { mutateAsync, status, error } = useApiClient().useMutation<
    CreateChecklistSetResponse,
    Omit<CreateChecklistSetRequest, "documents">
  >("put", "/checklist-sets");

  function updateChecklistSet(
    id: string,
    body: Omit<CreateChecklistSetRequest, "documents">
  ) {
    return mutateAsync(body, `/checklist-sets/${id}`);
  }

  return { updateChecklistSet, status, error };
}

export function useDeleteChecklistSet() {
  const { mutateAsync, status, error } = useApiClient().useMutation<
    CreateChecklistSetResponse,
    void
  >("delete", "/checklist-sets");

  function deleteChecklistSet(id: string) {
    return mutateAsync(undefined, `/checklist-sets/${id}`);
  }

  return { deleteChecklistSet, status, error };
}

export function useDuplicateChecklistSet() {
  const { mutateAsync, status, error } = useApiClient().useMutation<
    DuplicateChecklistSetResponse,
    DuplicateChecklistSetRequest
  >("post", "/checklist-sets");

  function duplicateChecklistSet(
    id: string,
    body?: DuplicateChecklistSetRequest
  ) {
    return mutateAsync(body || {}, `/checklist-sets/${id}/duplicate`);
  }

  return { duplicateChecklistSet, status, error };
}

/**
 * 曖昧検知実行フック
 */
export function useDetectAmbiguity() {
  const { mutateAsync, status, error } =
    useApiClient().useMutation<DetectAmbiguityResponse>(
      "post",
      "/checklist-sets"
    );

  const detectAmbiguity = async (setId: string) => {
    await mutateAsync({}, `/checklist-sets/${setId}/detect-ambiguity`);

    // API完了後に部分的楽観更新
    mutate(`/checklist-sets/${setId}`, (currentData: any) => ({
      ...currentData,
      processingStatus: "detecting",
    }));

    // 関連データを再取得
    mutate(`/checklist-sets/${setId}/items/hierarchy`);
  };

  return { detectAmbiguity, status, error };
}
