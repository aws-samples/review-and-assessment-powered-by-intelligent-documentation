/**
 * チェックリスト作成ページ
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageHeader from "../../../components/PageHeader";
import FormTextField from "../../../components/FormTextField";
import FormTextArea from "../../../components/FormTextArea";
import FormFileUpload from "../../../components/FormFileUpload";
import Button from "../../../components/Button";
import { useCreateChecklistSet } from "../hooks/useCheckListSetMutations";
import { useDocumentUpload } from "../../../hooks/useDocumentUpload";
import { HiExclamationCircle } from "react-icons/hi";
import { useToast } from "../../../contexts/ToastContext";
import { usePromptTemplates } from "../../prompt-template/hooks/usePromptTemplateQueries";
import { PromptTemplateSelector } from "../../prompt-template/components/PromptTemplateSelector";
import { PromptTemplateType } from "../../prompt-template/types";
import { validateFileSize, formatFileSize } from "../../../utils/fileValidation";
import { MAX_FILE_SIZE } from "../../../constants/index";

/**
 * チェックリスト作成ページ
 */
export function CreateChecklistPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { t } = useTranslation();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [errors, setErrors] = useState({
    name: "",
    files: "",
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState<
    string | undefined
  >(undefined);

  // プロンプトテンプレートを取得
  const { templates, isLoading: isLoadingTemplates } = usePromptTemplates(
    PromptTemplateType.CHECKLIST
  );

  const {
    createChecklistSet,
    status,
    error: createError,
  } = useCreateChecklistSet();
  const isCreating = status === "loading";
  const {
    uploadDocument,
    uploadedDocuments,
    clearUploadedDocuments,
    deleteDocument,
    isUploading,
    error: uploadError,
  } = useDocumentUpload({
    presignedUrlEndpoint: "/documents/checklist/presigned-url",
    deleteEndpointPrefix: "/documents/checklist/",
  });

  // 入力値の変更ハンドラ
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // 入力時にエラーをクリア
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // ファイル変更ハンドラ
  const handleFilesChange = async (newFiles: File[]) => {
    // ファイルサイズ検証
    const oversizedFiles = newFiles.filter(file => !validateFileSize(file, MAX_FILE_SIZE));
    if (oversizedFiles.length > 0) {
      const oversizedFileNames = oversizedFiles.map(file => 
        `${file.name} (${formatFileSize(file.size)})`
      ).join(', ');
      setErrors((prev) => ({
        ...prev,
        files: `${t("review.fileSizeError")}: ${oversizedFileNames}`,
      }));
      return;
    }

    setSelectedFiles(newFiles);

    // 新しく追加されたファイルのみをアップロード
    const existingFilenames =
      uploadedDocuments?.map((doc) => doc.filename) || [];
    const filesToUpload = newFiles.filter(
      (file) => !existingFilenames.includes(file.name)
    );

    if (filesToUpload.length === 0) return;

    try {
      // 現状、単一ファイルのみサポート
      const file = filesToUpload[0];
      await uploadDocument(file);

      // ファイル選択時にエラーをクリア
      if (errors.files) {
        setErrors((prev) => ({
          ...prev,
          files: "",
        }));
      }
    } catch (error) {
      console.error(t("fileUploader.fileUploadError"), error);
      addToast(t("checklist.fileUploadError"), "error");
    }
  };

  // ファイル削除ハンドラ
  const handleFileRemove = async (index: number) => {
    const fileToRemove = selectedFiles[index];

    // 選択済みファイルリストから削除
    const newSelectedFiles = [...selectedFiles];
    newSelectedFiles.splice(index, 1);
    setSelectedFiles(newSelectedFiles);

    // アップロード済みドキュメントリストからも削除
    const docToRemove = uploadedDocuments?.find(
      (doc) => doc.filename === fileToRemove.name
    );
    if (docToRemove) {
      // S3からも削除
      await deleteDocument(docToRemove.documentId);
    }

    // ファイルがなくなった場合はエラーを表示
    if (newSelectedFiles.length === 0) {
      setErrors((prev) => ({
        ...prev,
        files: t("checklist.fileRequired"),
      }));
    }
  };

  // バリデーション
  const validate = () => {
    const newErrors = {
      name: "",
      files: "",
    };

    if (!formData.name.trim()) {
      newErrors.name = t("checklist.nameRequired");
    }

    if (!uploadedDocuments || uploadedDocuments.length === 0) {
      newErrors.files = t("checklist.fileRequired");
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error);
  };

  // フォーム送信ハンドラ
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      await createChecklistSet({
        name: formData.name,
        description: formData.description,
        documents: uploadedDocuments || [],
        templateId: selectedTemplateId, // テンプレートIDを追加
      });

      // アップロード済みドキュメントリストをクリア
      clearUploadedDocuments();

      // 成功メッセージを表示
      addToast(t("checklist.createSuccess"), "success");

      // 作成成功後、一覧ページに遷移
      navigate("/checklist", { replace: true });
    } catch (error) {
      console.error(t("checklist.createError"), error);
      addToast(t("checklist.createError"), "error");
    }
  };

  // 表示するエラー
  const displayError = uploadError || createError;

  return (
    <div>
      <PageHeader
        title={t("checklist.createTitle")}
        description={t("checklist.createDescription")}
        backLink={{
          to: "/checklist",
          label: t("checklist.backToList"),
        }}
      />

      {displayError && (
        <div
          className="mb-6 rounded-md border border-red bg-light-red px-6 py-4 text-red shadow-sm"
          role="alert">
          <div className="flex items-center">
            <HiExclamationCircle className="mr-2 h-6 w-6" />
            <strong className="font-medium">{t("common.error")}: </strong>
            <span className="ml-2">{displayError.message}</span>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-light-gray bg-white p-6 shadow-md">
        <form onSubmit={handleSubmit}>
          <FormTextField
            id="name"
            name="name"
            label={t("checklist.name")}
            value={formData.name}
            onChange={handleInputChange}
            placeholder={t("checklist.namePlaceholder")}
            required
            error={errors.name}
          />

          <FormTextArea
            id="description"
            name="description"
            label={t("checklist.description")}
            value={formData.description}
            onChange={handleInputChange}
            placeholder={t("checklist.descriptionPlaceholder")}
          />

          <FormFileUpload
            label={t("fileUploader.files", { count: 0 })}
            files={selectedFiles}
            onFilesChange={handleFilesChange}
            required
            error={errors.files}
            isUploading={isUploading}
            multiple={false}
            uploadedDocuments={uploadedDocuments || []}
            onDeleteFile={handleFileRemove}
            acceptedFileTypes={{
              'application/pdf': ['.pdf']
            }}
          />

          {/* プロンプトテンプレート選択セクション */}
          <div className="mt-6 border-t border-light-gray pt-4">
            <h3 className="mb-4 text-lg font-medium">
              {t(
                "checklist.promptTemplateHeading",
                "Prompt Template Selection"
              )}
            </h3>

            <PromptTemplateSelector
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              onChange={setSelectedTemplateId}
              isLoading={isLoadingTemplates}
            />
          </div>

          <div className="mt-4 flex justify-end space-x-3">
            <Button outline to="/checklist">
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={
                isCreating ||
                isUploading ||
                !uploadedDocuments ||
                uploadedDocuments.length === 0
              }>
              {(isCreating || isUploading) && (
                <div className="-ml-1 mr-2 h-4 w-4 animate-spin text-white">
                  <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"></div>
                </div>
              )}
              {t("common.create")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
