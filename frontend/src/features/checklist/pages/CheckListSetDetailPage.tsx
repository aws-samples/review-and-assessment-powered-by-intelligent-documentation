import { useParams, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useChecklistSetDetail } from "../hooks/useCheckListSetQueries";
import {
  useDeleteChecklistSet,
  useDuplicateChecklistSet,
  useDetectAmbiguity,
} from "../hooks/useCheckListSetMutations";
import { useAlert } from "../../../hooks/useAlert";
import CheckListItemAddModal from "../components/CheckListItemAddModal";
import CheckListItemTree from "../components/CheckListItemTree";
import DuplicateChecklistModal from "../components/DuplicateChecklistModal";
import { useToast } from "../../../contexts/ToastContext";
import { DetailSkeleton } from "../../../components/Skeleton";
import SegmentedControl from "../../../components/SegmentedControl";
import {
  HiLockClosed,
  HiPlus,
  HiTrash,
  HiExclamation,
  HiInformationCircle,
  HiDuplicate,
  HiSparkles,
} from "react-icons/hi";
import Button from "../../../components/Button";
import Breadcrumb from "../../../components/Breadcrumb";
import { useChecklistItems } from "../hooks/useCheckListItemQueries";
import { ErrorAlert } from "../../../components/ErrorAlert";
import { mutate } from "swr";
import { getChecklistSetsKey } from "../hooks/useCheckListSetQueries";
import { AmbiguityFilter } from "../types";

/**
 * チェックリストセット詳細ページ
 */
export function CheckListSetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { checklistSet, isLoading, error } = useChecklistSetDetail(id || null);
  const {
    deleteChecklistSet,
    status: deleteStatus,
    error: deleteError,
  } = useDeleteChecklistSet();
  const { duplicateChecklistSet, status: duplicateStatus } =
    useDuplicateChecklistSet();
  const { detectAmbiguity, status: detectStatus } = useDetectAmbiguity();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [ambiguityFilter, setAmbiguityFilter] = useState<AmbiguityFilter>(
    AmbiguityFilter.ALL
  );
  const { refetch: refetchRoot } = useChecklistItems(id || null);
  const isDetecting = detectStatus === "loading";

  const { showConfirm, AlertModal } = useAlert();

  const handleDelete = async () => {
    if (!id) return;

    showConfirm(t("checklist.deleteConfirmation", { name: `#${id}` }), {
      title: t("common.confirm"),
      confirmButtonText: t("common.delete"),
      onConfirm: async () => {
        try {
          await deleteChecklistSet(id);
          addToast(t("checklist.deleteConfirm", { name: `#${id}` }), "success");
          navigate("/checklist", { replace: true });
        } catch (error) {
          console.error(t("common.error"), error);
          addToast(t("checklist.deleteError"), "error");
        }
      },
    });
  };

  const handleDuplicateClick = () => {
    if (checklistSet) {
      setNewName(`${checklistSet.name} (${t("common.duplicate")})`);
      setNewDescription(checklistSet.description);
      setIsDuplicateModalOpen(true);
    }
  };

  const handleDuplicateConfirm = async (name: string, description: string) => {
    if (!id) return;

    try {
      await duplicateChecklistSet(id, {
        name,
        description,
      });
      addToast(t("checklist.duplicateSuccess"), "success");
      setIsDuplicateModalOpen(false);
      // チェックリスト一覧を更新
      mutate(getChecklistSetsKey());
    } catch (error) {
      console.error(t("common.error"), error);
      addToast(t("checklist.duplicateError"), "error");
    }
  };

  const handleDetectAmbiguity = async () => {
    if (!id || !checklistSet?.isEditable) return;

    try {
      await detectAmbiguity(id);
      addToast(t("checklist.ambiguityDetectionSuccess"), "success");
    } catch (error) {
      console.error(t("common.error"), error);
      addToast(t("checklist.ambiguityDetectionError"), "error");
    }
  };

  if (isLoading) {
    return <DetailSkeleton lines={6} />;
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-red bg-light-red px-6 py-4 text-red shadow-sm"
        role="alert">
        <div className="flex items-center">
          <HiExclamation className="mr-2 h-6 w-6" />
          <strong className="font-medium">{t("common.error")}: </strong>
          <span className="ml-2">{t("checklist.fetchError")}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Breadcrumb to="/checklist" label={t("checklist.backToList")} />
          <h1 className="flex items-center text-3xl font-bold text-aws-squid-ink-light">
            {checklistSet
              ? checklistSet.name
              : t("checklist.checklistWithId", { id })}
            {checklistSet && !checklistSet.isEditable && (
              <div
                className="text-gray-500 ml-2"
                title={t("checklist.notEditableTitle")}>
                <HiLockClosed className="h-5 w-5" />
              </div>
            )}
          </h1>
          {checklistSet && checklistSet.description && (
            <p className="mt-1 text-aws-font-color-gray">
              {checklistSet.description}
            </p>
          )}

          {/* ドキュメント情報を表示 */}
          {checklistSet &&
            checklistSet.documents &&
            checklistSet.documents.length > 0 && (
              <div className="mt-2">
                <p className="text-aws-font-color-gray">
                  {t("checklist.document")}:{" "}
                  {checklistSet.documents[0].filename}
                </p>
              </div>
            )}
        </div>
        <div className="flex space-x-3">
          {/* 複製ボタン - 常に表示（編集不可でも複製は可能） */}
          <Button
            variant="secondary"
            onClick={handleDuplicateClick}
            disabled={duplicateStatus === "loading"}
            icon={<HiDuplicate className="h-5 w-5" />}>
            {t("common.duplicate")}
          </Button>

          {/* 削除ボタン - 編集可能な場合のみ表示 */}
          {checklistSet && checklistSet.isEditable && (
            <Button
              variant="danger"
              onClick={handleDelete}
              icon={<HiTrash className="h-5 w-5" />}>
              {t("common.delete")}
            </Button>
          )}
        </div>
      </div>

      {/* エラー詳細表示 */}
      {checklistSet && checklistSet.hasError && checklistSet.errorSummary && (
        <div className="mb-6">
          <ErrorAlert
            title={t("common.processingError")}
            message={checklistSet.errorSummary}
          />
        </div>
      )}

      <div className="mb-8 rounded-lg border border-light-gray bg-white p-6 shadow-md">
        {error ? (
          <div
            className="rounded-lg border border-red bg-light-red px-6 py-4 text-red shadow-sm"
            role="alert">
            <div className="flex items-center">
              <HiExclamation className="mr-2 h-6 w-6" />
              <strong className="font-medium">{t("common.error")}: </strong>
              <span className="ml-2">{t("checklist.itemsFetchError")}</span>
            </div>
          </div>
        ) : !id ? (
          <div
            className="rounded-lg border border-yellow bg-light-yellow px-6 py-4 text-yellow shadow-sm"
            role="alert">
            <div className="flex items-center">
              <HiInformationCircle className="mr-2 h-6 w-6" />
              <span>{t("checklist.noItems")}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <SegmentedControl
                options={[
                  {
                    value: AmbiguityFilter.ALL,
                    label: t("checklist.filterAll"),
                  },
                  {
                    value: AmbiguityFilter.HAS_AMBIGUITY,
                    label: t("checklist.filterNeedsReview"),
                  },
                ]}
                value={ambiguityFilter}
                onChange={(value) =>
                  setAmbiguityFilter(value as AmbiguityFilter)
                }
                name="ambiguity-filter"
              />
              {checklistSet && checklistSet.isEditable && (
                <Button
                  variant="primary"
                  outline={true}
                  onClick={handleDetectAmbiguity}
                  disabled={isDetecting}
                  icon={<HiSparkles className="h-5 w-5" />}>
                  {isDetecting
                    ? t("checklist.ambiguityDetecting")
                    : t("checklist.ambiguityDetect")}
                </Button>
              )}
            </div>
            <CheckListItemTree setId={id} ambiguityFilter={ambiguityFilter} />
          </>
        )}

        {checklistSet && (
          <div className="mt-6 flex justify-end">
            <Button
              variant="primary"
              icon={<HiPlus className="h-5 w-5" />}
              onClick={() => setIsAddModalOpen(true)}
              disabled={!checklistSet.isEditable}
              className={
                !checklistSet.isEditable ? "cursor-not-allowed opacity-50" : ""
              }>
              {t("checklist.addRootItem")}
            </Button>
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <CheckListItemAddModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          checkListSetId={id || ""}
          parentId="" // 明示的に空文字を指定してルート項目として追加
          onSuccess={() => {
            if (id) {
              refetchRoot();
              addToast(t("checklist.itemAddSuccess"), "success");
            }
          }}
        />
      )}

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
      <AlertModal />
    </div>
  );
}

export default CheckListSetDetailPage;
