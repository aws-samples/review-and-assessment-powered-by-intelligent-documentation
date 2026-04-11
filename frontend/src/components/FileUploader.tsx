/**
 * 共通ファイルアップロードコンポーネント
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { HiOutlineCloudUpload, HiOutlineDocumentText, HiOutlineCheckCircle, HiOutlineTrash } from 'react-icons/hi';
import { ImSpinner8 } from 'react-icons/im';
import Button from './Button';

export interface FileUploaderProps {
  onFilesChange: (files: File[]) => void;
  files: File[];
  acceptedFileTypes?: Record<string, string[]>;
  multiple?: boolean;
  isUploading?: boolean;
  uploadedDocuments?: Array<{ documentId: string; filename: string }>;
  onDeleteFile?: (index: number) => void;
}

/**
 * 共通ファイルアップロードコンポーネント
 */
export function FileUploader({ 
  onFilesChange, 
  files, 
  acceptedFileTypes = {
    'application/pdf': ['.pdf'],
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
  },
  multiple = false,
  isUploading = false,
  uploadedDocuments = [],
  onDeleteFile
}: FileUploaderProps) {
  const { t } = useTranslation();
  const supportedFormats = Object.values(acceptedFileTypes)
    .flat()
    .join(', ')
    .replace(/\./g, '');
  
  // ファイルドロップ処理
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (isUploading) return; // アップロード中は新しいファイルを追加しない
    onFilesChange([...files, ...acceptedFiles]);
  }, [files, onFilesChange, isUploading]);
  
  // ドロップゾーン設定
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    multiple,
    disabled: isUploading // アップロード中は無効化
  });
  
  // ファイル削除
  const removeFile = (index: number) => {
    if (isUploading) return; // アップロード中は削除しない
    const newFiles = [...files];
    newFiles.splice(index, 1);
    onFilesChange(newFiles);
  };
  
  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`flex min-h-[164px] items-center justify-center border-2 border-dashed rounded-md p-6 text-center transition-colors ${
          isUploading 
            ? 'border-light-gray bg-aws-paper-light opacity-70 cursor-not-allowed' 
            : isDragActive 
              ? 'border-aws-sea-blue-light bg-aws-paper-light cursor-pointer' 
              : 'border-light-gray hover:border-aws-sea-blue-light cursor-pointer'
        }`}
      >
        <input {...getInputProps()} disabled={isUploading} />
        <div className="flex min-h-[116px] flex-col items-center justify-center">
          {isUploading ? (
            <ImSpinner8 className="h-12 w-12 shrink-0 animate-spin text-aws-sea-blue-light" />
          ) : (
            <HiOutlineCloudUpload
              className={`h-12 w-12 shrink-0 ${
                isDragActive
                  ? 'text-aws-sea-blue-light'
                  : 'text-aws-font-color-gray'
              }`}
            />
          )}
          <div className="mt-2 flex min-h-[48px] max-w-[22rem] items-center justify-center">
            <p
              className={`${
                isDragActive
                  ? 'text-aws-sea-blue-light'
                  : 'text-aws-squid-ink-light'
              }`}>
              {isDragActive
                ? t('fileUploader.dropFiles')
                : isUploading
                  ? t('fileUploader.uploading')
                  : t('fileUploader.dragAndDrop')}
            </p>
          </div>
          <p
            className={`mt-1 text-sm ${
              isUploading ? 'select-none text-transparent' : 'text-aws-font-color-gray'
            }`}>
            {t('fileUploader.supportedFormats', { formats: supportedFormats })}
          </p>
        </div>
      </div>
      
      {files.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-aws-squid-ink-light mb-2">
            {t('fileUploader.files', { count: files.length })}
          </h3>
          <ul className="space-y-2">
            {files.map((file, index) => {
              // アップロード済みかどうかを確認
              const isUploaded = uploadedDocuments?.some(
                (doc) => doc.filename === file.name
              );

              return (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-2 bg-aws-paper-light rounded-md"
                >
                  <div className="flex items-center">
                    {isUploaded ? (
                      <HiOutlineCheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    ) : (
                      <HiOutlineDocumentText className="h-5 w-5 text-aws-font-color-gray mr-2" />
                    )}
                    <span className="text-sm truncate max-w-xs text-aws-squid-ink-light">
                      {file.name}
                    </span>
                    <span className="text-xs text-aws-font-color-gray ml-2">
                      {t('fileUploader.fileSize', { size: (file.size / 1024).toFixed(1) })}
                    </span>
                  </div>
                  <Button
                    onClick={() =>
                      onDeleteFile ? onDeleteFile(index) : removeFile(index)
                    }
                    variant="text"
                    size="sm"
                    icon={
                      <HiOutlineTrash className="h-5 w-5" />
                    }
                    disabled={isUploading}
                    className={`text-red hover:text-red ${
                      isUploading ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
