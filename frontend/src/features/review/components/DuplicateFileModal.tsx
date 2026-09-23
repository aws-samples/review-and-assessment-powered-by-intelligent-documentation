import { useTranslation } from "react-i18next";
import { HiExclamation } from "react-icons/hi";
import Modal from "../../../components/Modal";
import Button from "../../../components/Button";

export interface DuplicateFileModalProps {
  isOpen: boolean;
  /** 既に選択されているファイルと同じ名前 */
  filenames: string[];
  /** 選択済みの同名ファイルを外し、新しいファイルに差し替える */
  onReplace: () => void;
  /** 同名のファイルを両方とも審査対象にする */
  onKeepBoth: () => void;
  /** 今回追加したファイルを取り込まない */
  onCancel: () => void;
}

/**
 * 同じ名前のファイルが追加されたときに、どう扱うかを利用者に選んでもらう。
 * 同名でも別の内容であることは多いため、黙って置き換えたり無視したりしない。
 */
export default function DuplicateFileModal({
  isOpen,
  filenames,
  onReplace,
  onKeepBoth,
  onCancel,
}: DuplicateFileModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={
        <div className="flex items-center">
          <HiExclamation className="text-yellow-500 mr-2 h-8 w-8" />
          {t("review.duplicateFileTitle")}
        </div>
      }
      size="sm">
      <p className="text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
        {t("review.duplicateFileMessage")}
      </p>
      <ul className="my-3 list-inside list-disc text-sm text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
        {filenames.map((name) => (
          <li key={name} className="truncate">
            {name}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button outline onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button outline onClick={onKeepBoth}>
          {t("review.duplicateFileKeepBoth")}
        </Button>
        <Button variant="primary" onClick={onReplace}>
          {t("review.duplicateFileReplace")}
        </Button>
      </div>
    </Modal>
  );
}
