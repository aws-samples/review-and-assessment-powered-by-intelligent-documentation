/**
 * APIエントリーポイント
 */
import { createApp } from "./core/app";
import { registerChecklistRoutes } from "./features/checklist/routes";
import { registerReviewRoutes } from "./features/review/routes";
import { registerPromptTemplateRoutes } from "./features/prompt-template/routes";
import { registerUserPreferenceRoutes } from "./features/user-preference/routes";
import { registerToolConfigurationRoutes } from "./features/tool-configuration/routes";
import { authMiddleware } from "./core/middleware/auth";
import { errorHandler } from "./core/errors";
import { isLocalDevelopment } from "./core/utils/stage-aware-auth";

/**
 * アプリケーションを起動する
 */
async function startApp() {
  const app = createApp();

  // ローカル開発モードの場合、ログに表示
  if (isLocalDevelopment()) {
    console.log(
      "⚠️ Running in local development mode with authentication bypassed"
    );
  }

  // 認証ミドルウェアをデコレータとして登録
  app.decorate("auth", (request: any, reply: any) =>
    authMiddleware(request, reply)
  );

  // エラーハンドラーを登録
  app.setErrorHandler(errorHandler);

  // 認証が不要なパスのリスト
  const publicPaths = ["/health", "/api/health"];

  // グローバルなpreHandlerフックを追加して、すべてのルートに認証を適用
  app.addHook("preHandler", async (request, reply) => {
    // 公開パスの場合は認証をスキップ
    if (publicPaths.some((path) => request.url.startsWith(path))) {
      return;
    }

    // それ以外は認証を実行
    await authMiddleware(request, reply);
  });

  // ルートの登録
  registerChecklistRoutes(app);
  registerReviewRoutes(app);
  registerPromptTemplateRoutes(app);
  registerUserPreferenceRoutes(app);
  registerToolConfigurationRoutes(app);

  // アプリケーションの起動
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    const host = process.env.HOST || "0.0.0.0";

    await app.listen({ port, host });
    console.log(`Server is running on http://${host}:${port}`);
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  startApp();
}

// テスト用にエクスポート
export { createApp };
