import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { PromptTemplateList } from "../components/PromptTemplateList";
import { PromptTemplateEditor } from "../components/PromptTemplateEditor";
import { usePromptTemplates } from "../hooks/usePromptTemplateQueries";
import {
  useCreatePromptTemplate,
  useUpdatePromptTemplate,
  useDeletePromptTemplate,
} from "../hooks/usePromptTemplateMutations";
import Modal from "../../../components/Modal";
import { useAlert } from "../../../hooks/useAlert";
import { Toast } from "../../../components/Toast";
import { HiLightningBolt, HiPlus } from "react-icons/hi";
import Button from "../../../components/Button";
import {
  PromptTemplate,
  PromptTemplateType,
  UpdatePromptTemplateRequest,
} from "../types";

export const NextActionPromptTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { templates, isLoading, refetch } = usePromptTemplates(
    PromptTemplateType.NEXT_ACTION
  );
  const { createTemplate } = useCreatePromptTemplate();
  const { updateTemplate } = useUpdatePromptTemplate();
  const { deleteTemplate } = useDeletePromptTemplate();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<
    PromptTemplate | undefined
  >(undefined);
  const [toast, setToast] = useState<{
    id: string;
    message: string;
    type: "success" | "error";
  } | null>(null);

  const handleCreateNew = () => {
    setCurrentTemplate(undefined);
    setIsEditorOpen(true);
  };

  const handleEdit = (template: PromptTemplate) => {
    setCurrentTemplate(template);
    setIsEditorOpen(true);
  };

  const { showConfirm, showSuccess, showError, AlertModal } = useAlert();

  const handleDelete = (template: PromptTemplate) => {
    setCurrentTemplate(template);

    showConfirm(
      t("promptTemplate.deleteConfirmation", { name: template.name }),
      {
        title: t("promptTemplate.deleteTitle"),
        confirmButtonText: t("common.delete"),
        onConfirm: async () => {
          await handleConfirmDelete(template);
        },
      }
    );
  };

  const handleSave = async (data: UpdatePromptTemplateRequest) => {
    setIsSubmitting(true);
    try {
      if (currentTemplate) {
        await updateTemplate(currentTemplate.id, data);
        await refetch();
        setToast({
          id: `update-${new Date().getTime()}`,
          message: t("promptTemplate.updateSuccess"),
          type: "success",
        });
      } else {
        if (data.name && data.prompt) {
          await createTemplate({
            name: data.name,
            prompt: data.prompt,
            description: data.description,
            type: PromptTemplateType.NEXT_ACTION,
          });
          await refetch();
        } else {
          throw new Error(t("promptTemplate.requiredFieldsError"));
        }
        setToast({
          id: `create-${new Date().getTime()}`,
          message: t("promptTemplate.createSuccess"),
          type: "success",
        });
      }
      setIsEditorOpen(false);
    } catch (error) {
      setToast({
        id: `error-${new Date().getTime()}`,
        message: t("common.error"),
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async (template: PromptTemplate) => {
    setIsSubmitting(true);
    try {
      await deleteTemplate(template.id);
      await refetch();
      showSuccess(t("promptTemplate.deleteSuccess"));
    } catch (error) {
      showError(t("promptTemplate.deleteError"));
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center">
            <HiLightningBolt className="mr-2 h-8 w-8 text-aws-font-color-light dark:text-aws-font-color-dark" />
            <h1 className="text-3xl font-bold text-aws-font-color-light dark:text-aws-font-color-dark">
              {t("promptTemplate.nextActionPromptManagement")}
            </h1>
          </div>
          <p className="mt-2 text-aws-font-color-gray">
            {t("promptTemplate.nextActionPromptDescription")}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleCreateNew}
          icon={<HiPlus className="h-5 w-5" />}>
          {t("common.create")}
        </Button>
      </div>

      <PromptTemplateList
        templates={templates}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSetDefault={() => {}}
        onCreateNew={handleCreateNew}
        isLoading={isLoading}
      />

      {/* エディターモーダル */}
      {isEditorOpen && (
        <Modal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          title={
            currentTemplate
              ? t("promptTemplate.editTemplate")
              : t("promptTemplate.createNewTemplate")
          }
          size="lg">
          <PromptTemplateEditor
            template={currentTemplate}
            type={PromptTemplateType.NEXT_ACTION}
            onSave={handleSave}
            onCancel={() => setIsEditorOpen(false)}
            isSubmitting={isSubmitting}
          />
        </Modal>
      )}

      <AlertModal />

      {/* トースト通知 */}
      {toast && (
        <Toast
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
