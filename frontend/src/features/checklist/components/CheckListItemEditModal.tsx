import { useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../../../components/Modal";
import Button from "../../../components/Button";
import InfoAlert from "../../../components/InfoAlert";
import { CheckListItemEntity } from "../types";
import { useUpdateCheckListItem } from "../hooks/useCheckListItemMutations";
import { useToast } from "../../../contexts/ToastContext";

type CheckListItemEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  item: CheckListItemEntity;
  checkListSetId: string;
  onSuccess: () => void;
};

/**
 * チェックリスト項目編集モーダル
 */
export default function CheckListItemEditModal({
  isOpen,
  onClose,
  item,
  checkListSetId,
  onSuccess,
}: CheckListItemEditModalProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: item.name,
    description: item.description || "",
  });
  const [resolveAmbiguity, setResolveAmbiguity] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { addToast } = useToast();

  // コンポーネントのトップレベルでフックを呼び出す
  const {
    updateCheckListItem,
    status: updateStatus,
    error: updateError,
  } = useUpdateCheckListItem(checkListSetId);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError(t("checklist.editItemNameRequired"));
      return;
    }

    setIsSubmitting(true);

    try {
      await updateCheckListItem(item.id, {
        name: formData.name,
        description: formData.description,
        resolveAmbiguity: resolveAmbiguity,
      });
      addToast(t("checklist.editItemUpdateSuccess"), "success");
      onSuccess();
      onClose();
    } catch (err) {
      console.error("項目の更新に失敗しました", err);
      setError(t("checklist.editItemUpdateError"));
      addToast(t("checklist.editItemUpdateErrorToast"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("checklist.editItemTitle")}
      size="2xl">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-md border border-red bg-red/10 p-3 text-red">
            {error}
          </div>
        )}

        {/* 指摘事項表示 */}
        {item.ambiguityReview && (
          <div className="mb-4">
            <InfoAlert
              title={t("checklist.improvementSuggestions")}
              message={
                <ul className="space-y-3">
                  {item.ambiguityReview.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex">
                      <span className="mr-2 mt-1 flex-shrink-0">•</span>
                      <span className="whitespace-normal break-words">
                        {suggestion}
                      </span>
                    </li>
                  ))}
                </ul>
              }
              variant="warning"
            />
          </div>
        )}

        <div className="mb-6">
          <label
            htmlFor="name"
            className="mb-2 block font-medium text-aws-squid-ink-light">
            {t("checklist.name")} <span className="text-red">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`w-full rounded-md border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-aws-sea-blue-light ${
              !formData.name.trim() ? "border-red" : "border-light-gray"
            }`}
            placeholder="チェック項目の名前"
            required
          />
          {!formData.name.trim() && (
            <p className="mt-1 text-sm text-red">
              {t("checklist.editItemNameRequired")}
            </p>
          )}
        </div>

        <div className="mb-6">
          <label
            htmlFor="description"
            className="mb-2 block font-medium text-aws-squid-ink-light">
            {t("common.description")}
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full rounded-md border border-light-gray px-4 py-2 focus:outline-none focus:ring-2 focus:ring-aws-sea-blue-light"
            placeholder="チェック項目の説明"
          />
        </div>

        {/* 指摘解消チェックボックス */}
        {item.ambiguityReview && (
          <div className="mb-4 flex justify-end">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={resolveAmbiguity}
                onChange={(e) => setResolveAmbiguity(e.target.checked)}
                className="h-4 w-4 text-aws-sea-blue-light focus:ring-aws-sea-blue-light"
              />
              <span className="ml-2 text-sm text-aws-squid-ink-light">
                更新後に指摘を解消
              </span>
            </label>
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <Button outline onClick={onClose} type="button">
            {t("common.cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? t("checklist.editItemUpdating")
              : t("checklist.editItemUpdate")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
