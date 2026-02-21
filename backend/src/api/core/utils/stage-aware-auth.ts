/**
 * ステージに応じた認証処理を提供するモジュール
 */
import { FastifyRequest, FastifyReply } from "fastify";

/**
 * ローカル開発環境かどうかを判定する
 * @returns ローカル開発環境の場合はtrue
 */
export const isLocalDevelopment = (): boolean => {
  // AWS_LAMBDA_FUNCTION_NAME が存在する場合はLambda環境
  const isLambdaEnvironment = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  // ローカル開発環境の判定
  // Lambda環境でなく、かつ明示的にローカル開発モードが指定されている場合
  return !isLambdaEnvironment && process.env.RAPID_LOCAL_DEV === "true";
};

/**
 * ローカル開発用のモックユーザー情報をリクエストに設定する
 * @param request Fastifyリクエストオブジェクト
 */
export const setupLocalDevelopmentUser = (request: FastifyRequest): void => {
  // RequestUser 型に合わせて最低限のプロパティを設定する
  request.user = {
    userId: "local-dev-user-id",
    isAdmin: true,
    rawClaims: {
      sub: "local-dev-user-id",
      email: "local-dev@example.com",
      name: "Local Development User",
      "cognito:groups": ["Developers"],
    },
    // 互換性のため従来のクレームも保持しておく
    sub: "local-dev-user-id",
    email: "local-dev@example.com",
    name: "Local Development User",
    "cognito:groups": ["Developers"],
    // 必要に応じて追加の属性を設定
  };

  // デバッグ用にリクエストにマークを付ける（ログ出力用）
  (request as any).isLocalDevAuth = true;
};

/**
 * ローカル開発環境用の認証バイパス処理
 * @param request Fastifyリクエストオブジェクト
 * @param reply Fastifyレスポンスオブジェクト
 * @returns 認証処理が完了した場合はtrue、それ以外はfalse
 */
export const handleLocalDevelopmentAuth = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> => {
  if (isLocalDevelopment()) {
    setupLocalDevelopmentUser(request);
    return true; // 認証処理完了
  }
  return false; // 通常の認証処理へ続行
};
