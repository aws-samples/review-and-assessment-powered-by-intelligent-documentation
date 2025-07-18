import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SWRConfig } from "swr";
import Layout from "./components/Layout";
import {
  CheckListPage,
  CheckListSetDetailPage,
  CreateChecklistPage,
} from "./features/checklist";
import {
  ReviewListPage,
  CreateReviewPage,
  ReviewDetailPage,
} from "./features/review";
import NotFoundPage from "./pages/NotFoundPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { ToastProvider } from "./contexts/ToastContext";
import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ChecklistPromptTemplatesPage } from "./features/prompt-template/pages/ChecklistPromptTemplatesPage";
import { McpServersPage } from "./features/user-preference/pages/McpServersPage";
import "./App.css";

/**
 * アプリケーションのルートコンポーネント
 */
function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <SWRConfig
          value={{
            errorRetryCount: 3,
            revalidateOnFocus: false,
            revalidateIfStale: false,
            shouldRetryOnError: true,
          }}>
          <ToastProvider>
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}>
              <Routes>
                {/* ルートパスへのアクセスをチェックリストページにリダイレクト */}
                <Route
                  path="/"
                  element={<Navigate to="/checklist" replace />}
                />

                {/* 保護されたルート */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }>
                  {/* チェックリスト関連のルート */}
                  <Route path="checklist" element={<CheckListPage />} />
                  <Route
                    path="checklist/new"
                    element={<CreateChecklistPage />}
                  />
                  <Route
                    path="checklist/:id"
                    element={<CheckListSetDetailPage />}
                  />

                  {/* 審査関連のルート */}
                  <Route path="review" element={<ReviewListPage />} />
                  <Route path="review/create" element={<CreateReviewPage />} />
                  <Route path="review/:id" element={<ReviewDetailPage />} />

                  {/* プロンプトテンプレート関連のルート */}
                  <Route
                    path="prompt-templates/checklist"
                    element={<ChecklistPromptTemplatesPage />}
                  />

                  {/* MCPサーバー関連のルート */}
                  <Route path="mcp-servers" element={<McpServersPage />} />

                  {/* その他のルート */}
                  <Route path="documents" element={<ReviewListPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </SWRConfig>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
