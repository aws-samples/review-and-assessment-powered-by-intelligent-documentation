import { useApiClient } from "../../../hooks/useApiClient";
import { AmbiguityFilter } from "../types";
import type {
  CheckListItemEntity,
  CheckListItemDetail,
  GetChecklistItemsResponse,
  GetChecklistItemResponse,
} from "../types";

// 階層構造取得キー
export const getChecklistItemsKey = (
  setId: string | null,
  parentId?: string,
  includeAllChildren?: boolean,
  ambiguityFilter: AmbiguityFilter = AmbiguityFilter.ALL
) => {
  if (!setId) return null;
  const base = `/checklist-sets/${setId}/items`;
  const params = new URLSearchParams();
  if (parentId) params.append("parentId", parentId);
  if (includeAllChildren) params.append("includeAllChildren", "true");
  if (ambiguityFilter && ambiguityFilter !== AmbiguityFilter.ALL) {
    params.append("ambiguityFilter", ambiguityFilter);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
};

// 個別アイテム取得キー
export const getChecklistItemKey = (
  setId: string | null,
  itemId: string | null
) => (setId && itemId ? `/checklist-sets/${setId}/items/${itemId}` : null);

/**
 * チェックリスト項目（階層構造）の取得
 */
export function useChecklistItems(
  setId: string | null,
  parentId?: string,
  includeAllChildren?: boolean,
  ambiguityFilter: AmbiguityFilter = AmbiguityFilter.ALL
) {
  const url = getChecklistItemsKey(
    setId,
    parentId,
    includeAllChildren,
    ambiguityFilter
  );
  const { data, isLoading, error, refetch } =
    useApiClient().useQuery<GetChecklistItemsResponse>(url);

  return {
    items: data?.items ?? ([] as CheckListItemDetail[]),
    isLoading,
    error,
    refetch,
  };
}

/**
 * チェックリスト項目（単一）の取得
 */
export function useChecklistItem(setId: string | null, itemId: string | null) {
  const url = getChecklistItemKey(setId, itemId);
  const { data, isLoading, error } =
    useApiClient().useQuery<GetChecklistItemResponse>(url);

  return {
    item: data?.detail ?? (null as CheckListItemEntity | null),
    isLoading,
    error,
  };
}
