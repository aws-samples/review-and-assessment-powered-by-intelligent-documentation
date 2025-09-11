/**
 * チェックリスト項目の階層構造のノードコンポーネント
 * 子要素を動的に読み込む機能を持つ
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAlert } from "../../../hooks/useAlert";
import { CheckListItemDetail, AmbiguityFilter } from "../types";
import { useChecklistItems } from "../hooks/useCheckListItemQueries";
import {
  HiChevronDown,
  HiChevronRight,
  HiPencil,
  HiTrash,
  HiPlus,
} from "react-icons/hi";
import CheckListItemEditModal from "./CheckListItemEditModal";
import CheckListItemAddModal from "./CheckListItemAddModal";
import { useDeleteCheckListItem } from "../hooks/useCheckListItemMutations";
import Spinner from "../../../components/Spinner";
import { useChecklistSetDetail } from "../hooks/useCheckListSetQueries";
import Button from "../../../components/Button";
import ResultCard from "../../../components/ResultCard";

interface CheckListItemTreeNodeProps {
  setId: string;
  item: CheckListItemDetail;
  level: number;
  maxDepth?: number;
  autoExpand?: boolean;
  ambiguityFilter: AmbiguityFilter;
}

export default function CheckListItemTreeNode({
  setId,
  item,
  level,
  maxDepth = 2,
  autoExpand = false,
  ambiguityFilter,
}: CheckListItemTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < maxDepth || autoExpand);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddChildModalOpen, setIsAddChildModalOpen] = useState(false);

  const {
    deleteCheckListItem,
    status: delStatus,
    error: delError,
  } = useDeleteCheckListItem(item.setId);

  // チェックリストセットの詳細情報を取得
  const { checklistSet } = useChecklistSetDetail(setId || null);
  const isEditable = checklistSet?.isEditable ?? true;

  // 子項目を取得（レベルが最大深度未満の場合は自動的に、それ以外は展開時に）
  const shouldLoadChildren =
    item.hasChildren && (level < maxDepth || isExpanded);

  // 子項目を取得
  const {
    items: childItems,
    isLoading: isLoadingChildren,
    error: errorChildren,
    refetch: refetchChildren,
  } = useChecklistItems(
    setId || null,
    shouldLoadChildren ? item.id : undefined,
    false,
    ambiguityFilter
  );

  // ルートレベルのアイテムを取得するためのフック
  const { refetch: refetchRoot } = useChecklistItems(
    setId || null,
    undefined,
    false,
    ambiguityFilter
  );

  // 親レベルのアイテムを取得するためのフック（親IDがある場合のみ）
  const { refetch: refetchParent } = useChecklistItems(
    setId || null,
    item.parentId,
    false,
    ambiguityFilter
  );

  // 展開/折りたたみの切り替え
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // インデントのスタイル
  const indentStyle = {
    marginLeft: `${level * 20}px`,
  };

  const { t } = useTranslation();
  const { showConfirm, showError, AlertModal } = useAlert();

  const handleDelete = () => {
    if (!isEditable) return;

    showConfirm(t("checklist.deleteItemConfirmation", { name: item.name }), {
      title: t("common.confirm"),
      confirmButtonText: t("common.delete"),
      onConfirm: async () => {
        try {
          await deleteCheckListItem(item.id);
          // 親コンポーネントのrefetchを実行するため、階層構造を考慮
          if (level === 0) {
            // ルートレベルの場合、全体をrefetch
            refetchRoot();
          } else {
            // 親の子項目をrefetch
            refetchParent();
          }
        } catch {
          showError(`「${item.name}」の削除に失敗しました。`);
        }
      },
    });
  };

  return (
    <>
      <div>
        <div style={indentStyle}>
          <ResultCard
            variant={item.ambiguityReview && isEditable ? "error" : "default"}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {item.hasChildren && (
                  <button
                    onClick={toggleExpand}
                    className="mr-2 text-aws-font-color-gray transition-colors hover:text-aws-squid-ink-light">
                    {isExpanded ? (
                      <HiChevronDown className="h-5 w-5" />
                    ) : (
                      <HiChevronRight className="h-5 w-5" />
                    )}
                  </button>
                )}
                <div>
                  <div className="flex items-center font-medium text-aws-squid-ink-light">
                    {item.name}
                  </div>
                  {item.description && (
                    <p className="mt-1 text-sm text-aws-font-color-gray">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {/* 子項目追加ボタン - Button コンポーネントを使用 */}
                <Button
                  variant="text"
                  size="sm"
                  icon={<HiPlus className="h-5 w-5" />}
                  onClick={() => isEditable && setIsAddChildModalOpen(true)}
                  disabled={!isEditable}
                  title="子項目を追加"
                  aria-label="子項目を追加"
                  className={
                    !isEditable ? "text-gray-300 cursor-not-allowed" : ""
                  }
                />

                {/* 既存の編集ボタン - Button コンポーネントを使用 */}
                <Button
                  variant="text"
                  size="sm"
                  icon={
                    <div className="relative">
                      <HiPencil className="h-5 w-5" />
                      {item.ambiguityReview && isEditable && (
                        <span className="absolute -bottom-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-yellow text-xs text-white">
                          !
                        </span>
                      )}
                    </div>
                  }
                  onClick={() => isEditable && setIsEditModalOpen(true)}
                  disabled={!isEditable}
                  title="編集"
                  aria-label="編集"
                  className={
                    !isEditable
                      ? "text-gray-300 cursor-not-allowed"
                      : item.ambiguityReview && isEditable
                        ? "text-yellow border-yellow hover:bg-yellow hover:bg-opacity-10" 
                        : "text-aws-aqua hover:text-aws-sea-blue-light"
                  }
                />

                {/* 既存の削除ボタン - Button コンポーネントを使用 */}
                <Button
                  variant="text"
                  size="sm"
                  icon={<HiTrash className="h-5 w-5" />}
                  onClick={handleDelete}
                  disabled={!isEditable}
                  title="削除"
                  aria-label="削除"
                  className={
                    !isEditable
                      ? "text-gray-300 cursor-not-allowed"
                      : "rounded p-1 text-red hover:bg-light-red hover:text-light-red"
                  }
                />
              </div>
            </div>
          </ResultCard>
        </div>

        {isEditModalOpen && (
          <CheckListItemEditModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            item={item}
            onSuccess={() => {
              if (level === 0) {
                // ルートレベルの場合、全体をrefetch
                refetchRoot();
              } else {
                // 親の子項目をrefetch
                refetchParent();
              }
              refetchChildren(); // 子項目を再取得
              setIsEditModalOpen(false);
            }}
            checkListSetId={item.setId}
          />
        )}

        {/* 子項目追加モーダル */}
        {isAddChildModalOpen && (
          <CheckListItemAddModal
            isOpen={isAddChildModalOpen}
            onClose={() => setIsAddChildModalOpen(false)}
            checkListSetId={setId}
            parentId={item.id}
            onSuccess={() => {
              setIsExpanded(true); // 追加後に自動的に展開

              console.log(`level: ${level}`);
              if (level === 0) {
                // ルートレベルの場合、全体をrefetch
                refetchRoot();
              } else {
                // 親の子項目をrefetch
                refetchParent();
              }
              refetchChildren(); // 子項目を再取得
              setIsAddChildModalOpen(false);
            }}
          />
        )}

        {/* 子項目を表示（展開時のみ） */}
        {isExpanded && item.hasChildren && (
          <div className="mt-2 space-y-2">
            {isLoadingChildren ? (
              <div
                className="flex justify-center py-4"
                style={{ marginLeft: `${(level + 1) * 20}px` }}>
                <Spinner size="md" />
              </div>
            ) : errorChildren ? (
              <div
                className="text-red-500 py-2"
                style={{ marginLeft: `${(level + 1) * 20}px` }}>
                子項目の読み込みに失敗しました。
              </div>
            ) : (
              childItems.map((childItem) => (
                <CheckListItemTreeNode
                  key={childItem.id}
                  setId={setId}
                  item={childItem}
                  level={level + 1}
                  maxDepth={maxDepth}
                  ambiguityFilter={ambiguityFilter}
                />
              ))
            )}
          </div>
        )}
      </div>
      <AlertModal />
    </>
  );
}
