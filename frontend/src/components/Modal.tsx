/**
 * モーダルコンポーネント
 */
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HiX } from "react-icons/hi";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: ModalProps) {
  const { t } = useTranslation();

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);

    // モーダルが開いている間はスクロールを無効化
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose]);

  // モーダルが閉じている場合は何も表示しない
  if (!isOpen) return null;

  // サイズに応じたクラスを取得
  const getSizeClass = () => {
    switch (size) {
      case "sm":
        return "max-w-md";
      case "md":
        return "max-w-lg";
      case "lg":
        return "max-w-2xl";
      case "xl":
        return "max-w-4xl";
      case "2xl":
        return "max-w-6xl";
      default:
        return "max-w-lg";
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"></div>

      {/* モーダルコンテンツ */}
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div
          className={`${getSizeClass()} w-full transform overflow-hidden rounded-lg bg-white text-left align-middle shadow-xl transition-all`}
          onClick={(e) => e.stopPropagation()}>
          {/* ヘッダー */}
          <div className="flex items-center justify-between border-b border-light-gray px-6 py-4">
            <h3 className="text-lg font-medium text-aws-squid-ink-light">
              {title}
            </h3>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
              onClick={onClose}>
              <span className="sr-only">{t("common.close")}</span>
              <HiX className="h-6 w-6" />
            </button>
          </div>

          {/* コンテンツ */}
          <div className="px-6 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
