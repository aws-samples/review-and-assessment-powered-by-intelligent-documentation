import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Button from "../../../components/Button";
import PageHeader from "../../../components/PageHeader";
import FormTextField from "../../../components/FormTextField";
import FormFileUpload from "../../../components/FormFileUpload";
import ChecklistSelector from "../components/ChecklistSelector";
import ComparisonIndicator from "../components/ComparisonIndicator";
import { useCreateReviewJob } from "../hooks/useReviewJobMutations";
import { useDocumentUpload } from "../../../hooks/useDocumentUpload";
import { useChecklistSets } from "../../checklist/hooks/useCheckListSetQueries";
import { CHECK_LIST_STATUS, CheckListSet } from "../../checklist/types";
import {
  HiExclamationCircle,
  HiDocumentText,
  HiPhotograph,
} from "react-icons/hi";
import SegmentedControl from "../../../components/SegmentedControl";
import { REVIEW_FILE_TYPE } from "../types";
import {
  validateFileSize,
  formatFileSize,
} from "../../../utils/fileValidation";
import { MAX_FILE_SIZE } from "../../../constants/index";

export const CreateReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedChecklist, setSelectedChecklist] =
    useState<CheckListSet | null>(null);
  const [jobName, setJobName] = useState("");
  const [fileType, setFileType] = useState<REVIEW_FILE_TYPE>(
    REVIEW_FILE_TYPE.PDF
  );
  const [checklistPage, setChecklistPage] = useState(1);
  const [checklistLimit] = useState(5);
  const [errors, setErrors] = useState({
    name: "",
    files: "",
  });

  // チェックリストセット一覧を取得（完成状態のみ）
  const {
    items: checkListSets,
    isLoading: isLoadingCheckListSets,
    error: checkListSetsError,
    total: checklistTotal,
    totalPages: checklistTotalPages,
  } = useChecklistSets(
    checklistPage,
    checklistLimit,
    "id",
    "desc",
    CHECK_LIST_STATUS.COMPLETED
  );

  // 審査ジョブ作成フック
  const { createReviewJob, status, error: createError } = useCreateReviewJob();
  const isSubmitting = status === "loading";

  // ドキュメントアップロードフック
  const {
    uploadDocument,
    uploadDocuments,
    clearUploadedDocuments,
    deleteDocument,
    isUploading,
    error: uploadError,
    uploadedDocuments,
  } = useDocumentUpload({
    presignedUrlEndpoint: "/documents/review/presigned-url",
    imagesPresignedUrlEndpoint: "/documents/review/images/presigned-url",
    deleteEndpointPrefix: "/documents/review/",
  });

  // ファイルが選択されチェックリストも選択されているかチェック
  const isReady =
    uploadedDocuments?.length > 0 &&
    selectedChecklist !== null &&
    jobName.trim() !== "";

  // ファイルタイプ選択ハンドラ
  const handleFileTypeChange = (value: string) => {
    setFileType(value as REVIEW_FILE_TYPE);
    setSelectedFiles([]);
    clearUploadedDocuments();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "jobName") {
      setJobName(value);
    }

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
    const oversizedFiles = newFiles.filter(
      (file) => !validateFileSize(file, MAX_FILE_SIZE)
    );
    if (oversizedFiles.length > 0) {
      const oversizedFileNames = oversizedFiles
        .map((file) => `${file.name} (${formatFileSize(file.size)})`)
        .join(", ");
      setErrors((prev) => ({
        ...prev,
        files: `${t("review.fileSizeError")}: ${oversizedFileNames}`,
      }));
      return;
    }

    // ファイルタイプに基づいて検証
    if (fileType === REVIEW_FILE_TYPE.PDF && newFiles.length > 1) {
      setErrors((prev) => ({
        ...prev,
        files: t("review.pdfLimitError"),
      }));
      return;
    }

    if (fileType === REVIEW_FILE_TYPE.IMAGE && newFiles.length > 20) {
      setErrors((prev) => ({
        ...prev,
        files: t("review.imageLimitError"),
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
      if (fileType === REVIEW_FILE_TYPE.PDF) {
        // PDFファイルの場合は1つだけアップロード
        const file = filesToUpload[0];
        const uploadResult = await uploadDocument(file);

        // ファイル名をジョブ名の初期値として設定（ファイルが1つの場合）
        if (newFiles.length === 1 && !jobName) {
          // 拡張子を除いたファイル名を設定
          const fileName = file.name;
          const nameWithoutExtension =
            fileName.substring(0, fileName.lastIndexOf(".")) || fileName;
          setJobName(`${nameWithoutExtension}${t("review.jobNameSuffix")}`);
        }
      } else {
        // 画像ファイルの場合は複数アップロード
        const uploadResults = await uploadDocuments(filesToUpload);

        // ファイル名をジョブ名の初期値として設定（ファイルが1つの場合）
        if (newFiles.length === 1 && !jobName) {
          const fileName = newFiles[0].name;
          const nameWithoutExtension =
            fileName.substring(0, fileName.lastIndexOf(".")) || fileName;
          setJobName(`${nameWithoutExtension}${t("review.jobNameSuffix")}`);
        }
      }

      // ファイル選択時にエラーをクリア
      if (errors.files) {
        setErrors((prev) => ({
          ...prev,
          files: "",
        }));
      }
    } catch (error) {
      console.error(t("review.fileUploadError"), error);
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
    const docToRemove = uploadedDocuments.find(
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
        files: t("review.fileRequired"),
      }));
    }
  };

  // チェックリスト選択ハンドラ
  const handleChecklistSelect = (checklist: CheckListSet) => {
    setSelectedChecklist(checklist);
  };

  // バリデーション
  const validate = () => {
    const newErrors = {
      name: "",
      files: "",
    };

    if (!jobName.trim()) {
      newErrors.name = t("review.nameRequired");
    }

    if (!uploadedDocuments?.length) {
      newErrors.files = t("review.fileRequired");
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error);
  };

  // フォーム送信ハンドラ
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate() || !selectedChecklist) return;

    try {
      // すべてのドキュメントを同じ構造で扱う
      const documents = uploadedDocuments.map((doc) => ({
        id: doc.documentId,
        filename: doc.filename,
        s3Key: doc.s3Key,
        fileType: fileType,
      }));

      await createReviewJob({
        name: jobName,
        checkListSetId: selectedChecklist.id,
        documents: documents,
      });

      clearUploadedDocuments();

      // 作成成功後、一覧ページに遷移
      navigate("/review", { replace: true });
    } catch (error) {
      console.error(t("review.createError"), error);
    }
  };

  // 表示するエラー
  const displayError = uploadError || createError;

  return (
    <div>
      <PageHeader
        title={t("review.createTitle")}
        description={t("review.createDescription")}
        backLink={{
          to: "/review",
          label: t("review.backToList"),
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
            id="jobName"
            name="jobName"
            label={t("review.jobName")}
            value={jobName}
            onChange={handleInputChange}
            placeholder={t("review.jobNamePlaceholder")}
            required
            error={errors.name}
          />

          <div className="mb-6">
            <label className="mb-2 block font-medium text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
              {t("review.fileType")} <span className="text-red">*</span>
            </label>
            <SegmentedControl
              name="fileType"
              options={[
                {
                  value: REVIEW_FILE_TYPE.PDF,
                  label: t("review.pdfFile"),
                  icon: <HiDocumentText />,
                },
                {
                  value: REVIEW_FILE_TYPE.IMAGE,
                  label: t("review.imageFiles"),
                  icon: <HiPhotograph />,
                },
              ]}
              value={fileType}
              onChange={handleFileTypeChange}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-7">
            {/* 左側: ファイルアップロード */}
            <div className="lg:col-span-3">
              <FormFileUpload
                label={t("review.targetFiles")}
                files={selectedFiles}
                onFilesChange={handleFilesChange}
                required
                error={errors.files}
                isUploading={isUploading}
                multiple={fileType === REVIEW_FILE_TYPE.IMAGE}
                uploadedDocuments={uploadedDocuments}
                onDeleteFile={handleFileRemove}
                acceptedFileTypes={
                  fileType === REVIEW_FILE_TYPE.PDF
                    ? { "application/pdf": [".pdf"] }
                    : { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] }
                }
              />
            </div>

            {/* 中央: 比較アイコン */}
            <div className="flex items-center justify-center py-4 lg:col-span-1">
              <ComparisonIndicator isReady={isReady} />
            </div>

            {/* 右側: チェックリスト選択 */}
            <div className="lg:col-span-3">
              {isLoadingCheckListSets ? (
                <div className="flex h-full items-center justify-center p-8">
                  <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2 border-t-2"></div>
                </div>
              ) : checkListSetsError ? (
                <div className="rounded-md border border-red p-4 text-red">
                  {t("checklist.loadError")}
                </div>
              ) : (
                <ChecklistSelector
                  checklists={checkListSets || []}
                  selectedChecklistId={selectedChecklist?.id || null}
                  onSelectChecklist={handleChecklistSelect}
                  currentPage={checklistPage}
                  totalPages={checklistTotalPages}
                  totalItems={checklistTotal}
                  itemsPerPage={checklistLimit}
                  onPageChange={setChecklistPage}
                  isLoading={isLoadingCheckListSets}
                />
              )}
            </div>
          </div>

          <div className="mt-8 flex justify-end space-x-3">
            <Button outline to="/review">
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!isReady || isSubmitting || isUploading}>
              {isSubmitting || isUploading ? (
                <>
                  <div className="-ml-1 mr-2 h-4 w-4 animate-spin text-white">
                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"></div>
                  </div>
                  {t("common.processing")}
                </>
              ) : (
                t("review.compare")
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateReviewPage;
