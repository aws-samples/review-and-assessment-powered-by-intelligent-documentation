/**
 * チェックリスト項目の階層構造を表示するツリーコンポーネント
 */
import { useChecklistItems } from "../hooks/useCheckListItemQueries";
import CheckListItemTreeNode from "./CheckListItemTreeNode";
import { TreeSkeleton } from "../../../components/Skeleton";
import { AmbiguityFilter } from "../types";

interface CheckListItemTreeProps {
  setId: string;
  maxDepth?: number;
  ambiguityFilter: AmbiguityFilter;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export default function CheckListItemTree({
  setId,
  maxDepth = 2,
  ambiguityFilter = AmbiguityFilter.ALL,
  selectedIds,
  onToggleSelect,
}: CheckListItemTreeProps) {
  const {
    items: rootItems,
    isLoading: isLoadingRoot,
    error: errorRoot,
  } = useChecklistItems(setId || null, undefined, false, ambiguityFilter);

  if (isLoadingRoot) {
    return <TreeSkeleton nodes={3} />;
  }

  if (errorRoot) {
    return (
      <div className="text-red-500 py-10 text-center">
        チェックリスト項目の読み込みに失敗しました。
      </div>
    );
  }

  if (rootItems.length === 0) {
    return (
      <div className="text-gray-500 py-10 text-center">
        チェックリスト項目がありません
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rootItems.map((item) => (
        <CheckListItemTreeNode
          key={item.id}
          setId={setId}
          item={item}
          level={0}
          maxDepth={maxDepth}
          ambiguityFilter={ambiguityFilter}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}
