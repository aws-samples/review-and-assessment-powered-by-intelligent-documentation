import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  HiX,
  HiMenu,
  HiCheck,
  HiDocumentText,
  HiInformationCircle,
  HiLogout,
  HiUser,
  HiCog,
  HiChevronDown,
  HiChevronRight,
  HiAnnotation,
} from "react-icons/hi";
import { useAuth } from "../contexts/AuthContext";
import LanguageSwitcher from "./LanguageSwitcher";
import { getVersion } from "../utils/version";

/**
 * サイドバーコンポーネント
 * レスポンシブ対応のサイドナビゲーション
 */
export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPromptMenuOpen, setIsPromptMenuOpen] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { t } = useTranslation();

  // 現在のパスに基づいてアクティブなメニュー項目を判定
  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  // サイドバーの開閉を切り替える
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  // プロンプト管理メニューの開閉を切り替える
  const togglePromptMenu = () => {
    setIsPromptMenuOpen(!isPromptMenuOpen);
  };

  // ログアウト処理
  const handleLogout = async () => {
    await signOut();
  };

  return (
    <>
      {/* モバイル用のハンバーガーメニュー */}
      <button
        className="fixed left-4 top-4 z-50 rounded-md bg-aws-squid-ink-light p-2 text-aws-font-color-white-light md:hidden"
        onClick={toggleSidebar}
        aria-label={t("sidebar.menu")}>
        {isOpen ? <HiX className="h-6 w-6" /> : <HiMenu className="h-6 w-6" />}
      </button>

      {/* サイドバー */}
      <div
        className={`fixed left-0 top-0 z-40 h-full w-64 transform bg-aws-squid-ink-light text-aws-font-color-white-light transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}>
        <div className="p-6">
          <nav>
            <ul className="space-y-2">
              <li className="mb-1">
                <Link
                  to="/checklist"
                  className={`flex items-center rounded-md px-4 py-3 transition-colors ${
                    isActive("/checklist")
                      ? "bg-aws-sea-blue-light text-aws-font-color-white-light"
                      : "text-aws-font-color-white-light hover:bg-aws-sea-blue-hover-light"
                  }`}
                  onClick={() => setIsOpen(false)}>
                  <HiCheck className="mr-3 h-5 w-5" />
                  {t("sidebar.checklist")}
                </Link>
              </li>
              <li className="mb-1">
                <Link
                  to="/review"
                  className={`flex items-center rounded-md px-4 py-3 transition-colors ${
                    isActive("/review")
                      ? "bg-aws-sea-blue-light text-aws-font-color-white-light"
                      : "text-aws-font-color-white-light hover:bg-aws-sea-blue-hover-light"
                  }`}
                  onClick={() => setIsOpen(false)}>
                  <HiDocumentText className="mr-3 h-5 w-5" />
                  {t("sidebar.review")}
                </Link>
              </li>

              {/* プロンプト管理メニュー */}
              <li className="mb-1">
                <button
                  className={`flex w-full items-center rounded-md px-4 py-3 transition-colors ${
                    isActive("/prompt-templates")
                      ? "bg-aws-sea-blue-light text-aws-font-color-white-light"
                      : "text-aws-font-color-white-light hover:bg-aws-sea-blue-hover-light"
                  }`}
                  onClick={togglePromptMenu}>
                  <HiAnnotation className="mr-3 h-5 w-5" />
                  {t("sidebar.settings")}
                  <span className="ml-auto">
                    {isPromptMenuOpen ? (
                      <HiChevronDown className="h-4 w-4" />
                    ) : (
                      <HiChevronRight className="h-4 w-4" />
                    )}
                  </span>
                </button>

                {/* サブメニュー */}
                {isPromptMenuOpen && (
                  <ul className="ml-6 mt-1 space-y-1">
                    <li>
                      <Link
                        to="/prompt-templates/checklist"
                        className={`mt-2 flex items-center rounded-md px-4 py-2 transition-colors ${
                          isActive("/prompt-templates/checklist")
                            ? "bg-aws-sea-blue-light text-aws-font-color-white-light"
                            : "text-aws-font-color-white-light hover:bg-aws-sea-blue-hover-light"
                        }`}
                        onClick={() => setIsOpen(false)}>
                        {t("sidebar.checklistPrompt")}
                      </Link>
                    </li>
                  </ul>
                )}
                <li>
                  <Link
                    to="/mcp-servers"
                    className={`mt-2 flex items-center rounded-md px-4 py-2 transition-colors ${
                      isActive("/mcp-servers")
                        ? "bg-aws-sea-blue-light text-aws-font-color-white-light"
                        : "text-aws-font-color-white-light hover:bg-aws-sea-blue-hover-light"
                    }`}
                    onClick={() => setIsOpen(false)}>
                    <span className="flex items-center">
                      {t("mcpServer.title")}
                      <span className="bg-yellow-200 text-yellow-800 ml-1 inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium">
                        {t("experimental.beta")}
                      </span>
                    </span>
                  </Link>
                </li>
              </li>
            </ul>
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-6">
            {/* ユーザーメニュー */}
            {user && (
              <div className="border-t border-aws-font-color-white-light border-opacity-20 pt-4">
                <div className="mb-2 flex items-center">
                  <HiUser className="mr-2 h-5 w-5" />
                  <span className="truncate text-sm">
                    { user.email || user.username}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center rounded-md px-4 py-2 text-sm transition-colors hover:bg-aws-sea-blue-hover-light">
                  <HiLogout className="mr-2 h-4 w-4" />
                  {t("common.logout")}
                </button>

                {/* 言語切り替えボタン */}
                <LanguageSwitcher />

                {/* バージョン情報 */}
                <div className="mt-4 border-t border-aws-font-color-white-light border-opacity-20 pt-2">
                  <div className="text-center text-xs text-aws-font-color-white-light text-opacity-70">
                    Version: {getVersion()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* モバイル表示時のオーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 md:hidden"
          onClick={toggleSidebar}></div>
      )}
    </>
  );
}
