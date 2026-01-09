import { useState, useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useChecklistSets } from "../hooks/useCheckListSetQueries";
import {
  useDeleteChecklistSet,
  useDuplicateChecklistSet,
} from "../hooks/useCheckListSetMutations";
import { useToast } from "../../../contexts/ToastContext";
import CheckListSetList from "../components/CheckListSetList";
import CreateChecklistButton from "../components/CreateChecklistButton";
import DuplicateChecklistModal from "../components/DuplicateChecklistModal";
import Pagination from "../../../components/Pagination";
import { HiCheck } from "react-icons/hi";
import { mutate } from "swr";
import { getChecklistSetsKey } from "../hooks/useCheckListSetQueries";
import { OnboardingModal } from "../../examples";
import { useLocalStorage } from "../../../hooks/useLocalStorage";

/**
 * チェックリスト一覧ページ
 */
export function CheckListPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useToast();
  const { t } = useTranslation();

  // 複製用の状態を追加
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(
    null
  );
  const [selectedChecklistName, setSelectedChecklistName] =
    useState<string>("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // オンボーディングモーダル用の状態
  const [onboardingCompleted, setOnboardingCompleted] = useLocalStorage<boolean>(
    "onboarding_completed",
    false
  );
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  const {
    items: checkListSets,
    total,
    page,
    limit,
    totalPages,
    isLoading,
    error,
    refetch,
  } = useChecklistSets(currentPage, itemsPerPage, "id", "desc");

  const {
    deleteChecklistSet,
    status: deleteStatus,
    error: deleteError,
  } = useDeleteChecklistSet();

  // 複製フックを追加
  const { duplicateChecklistSet, status: duplicateStatus } =
    useDuplicateChecklistSet();

  // 画面表示時またはlocationが変わった時にデータを再取得
  useEffect(() => {
    // 新規作成後に一覧画面に戻ってきた場合など、locationが変わった時にデータを再取得
    refetch();
  }, [location, refetch]);

  // オンボーディングモーダルの表示制御
  useEffect(() => {
    // 開発用: クエリパラメータで強制表示
    const showOnboardingParam = searchParams.get("showOnboarding");
    if (showOnboardingParam === "true") {
      setShowOnboardingModal(true);
      return;
    }

    // 通常の表示条件: オンボーディングが完了していない場合かつチェックリストが0件の場合
    if (!onboardingCompleted && !isLoading && checkListSets?.length === 0) {
      setShowOnboardingModal(true);
    }
  }, [onboardingCompleted, isLoading, checkListSets, searchParams]);

  // チェックリストセットの削除処理
  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteChecklistSet(id);
      // 削除後にリストを再取得
      refetch();
      // 削除成功のトースト通知を表示
      addToast(t("checklist.deleteConfirm", { name }), "success");
    } catch (error) {
      console.error("削除に失敗しました", error);
      // 削除失敗のトースト通知を表示
      addToast(t("checklist.deleteError"), "error");
    }
  };

  // 複製モーダルを開く処理
  const handleDuplicateClick = (id: string, name: string) => {
    setSelectedChecklistId(id);
    setSelectedChecklistName(name);
    setNewName(`${name} (${t("common.duplicate")})`);
    setNewDescription(""); // 説明は空にしておく
    setIsDuplicateModalOpen(true);
  };

  // 複製確認処理
  const handleDuplicateConfirm = async (name: string, description: string) => {
    if (!selectedChecklistId) return;

    try {
      await duplicateChecklistSet(selectedChecklistId, {
        name,
        description,
      });

      // 複製成功のトースト通知を表示
      addToast(t("checklist.duplicateSuccess"), "success");

      // モーダルを閉じる
      setIsDuplicateModalOpen(false);

      // チェックリスト一覧を更新
      mutate(getChecklistSetsKey(currentPage, itemsPerPage));
      refetch();
    } catch (error) {
      console.error(t("common.error"), error);
      addToast(t("checklist.duplicateError"), "error");
    }
  };

  // オンボーディングモーダルの「今後表示しない」処理
  const handleDontShowAgain = () => {
    setOnboardingCompleted(true);
    // クエリパラメータを削除
    const showOnboardingParam = searchParams.get("showOnboarding");
    if (showOnboardingParam === "true") {
      searchParams.delete("showOnboarding");
      setSearchParams(searchParams);
    }
  };

  // オンボーディングモーダルを閉じる処理
  const handleCloseOnboarding = () => {
    setShowOnboardingModal(false);
    // クエリパラメータを削除
    const showOnboardingParam = searchParams.get("showOnboarding");
    if (showOnboardingParam === "true") {
      searchParams.delete("showOnboarding");
      setSearchParams(searchParams);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center">
            <HiCheck className="mr-2 h-8 w-8 text-aws-font-color-light dark:text-aws-font-color-dark" />
            <h1 className="text-3xl font-bold text-aws-font-color-light dark:text-aws-font-color-dark">
              {t("checklist.title")}
            </h1>
          </div>
          <p className="mt-2 text-aws-font-color-gray">
            {t("checklist.description")}
          </p>
        </div>
        <CreateChecklistButton />
      </div>

      <CheckListSetList
        checkListSets={checkListSets || []}
        isLoading={isLoading}
        error={error}
        onDelete={handleDelete}
        onDuplicate={handleDuplicateClick} // 複製ハンドラーを渡す
      />

      {/* ページネーション */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={total}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        isLoading={isLoading}
      />

      {/* 複製ダイアログ */}
      {isDuplicateModalOpen && (
        <DuplicateChecklistModal
          isOpen={isDuplicateModalOpen}
          onClose={() => setIsDuplicateModalOpen(false)}
          onConfirm={handleDuplicateConfirm}
          initialName={newName}
          initialDescription={newDescription}
          isLoading={duplicateStatus === "loading"}
        />
      )}

      {/* オンボーディングモーダル */}
      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={handleCloseOnboarding}
        onDontShowAgain={handleDontShowAgain}
      />
    </div>
  );
}

export default CheckListPage;
