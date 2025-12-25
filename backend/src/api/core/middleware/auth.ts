import { FastifyRequest, FastifyReply } from "fastify";
import { JwtVerifier } from "../utils/jwt-verifier";
import { handleLocalDevelopmentAuth } from "../utils/stage-aware-auth";
import type { RequestUser } from "./authorization";

// 認証ミドルウェアのオプション
export interface AuthOptions {
  required?: boolean; // 認証が必須かどうか
}

// JWTトークンの検証と認証を行うミドルウェア
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  options: AuthOptions = { required: true }
) {
  try {
    // ローカル開発環境の場合は認証をバイパス
    const isLocalAuthHandled = await handleLocalDevelopmentAuth(request, reply);
    if (isLocalAuthHandled) {
      return; // ローカル開発環境では認証済みとして処理を続行
    }

    // Authorizationヘッダーからトークンを取得
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      if (options.required) {
        return reply
          .code(401)
          .send({ success: false, error: "Authorization header is missing" });
      }
      return; // 認証が必須でない場合は続行
    }

    // Bearer トークンの形式を確認
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return reply.code(401).send({
        success: false,
        error: "Authorization header format is invalid",
      });
    }

    const token = parts[1];
    const verifier = new JwtVerifier();

    // トークンを検証
    const payload = await verifier.verify(token);

    // 検証に成功したらリクエストにユーザー情報を追加
    // カスタムクレーム 'custom:rapid_role' を参照して isAdmin を設定する。
    // payload 内に 'custom:rapid_role' がない場合はフォールバックとして isAdmin=false を採用する（運用でトークンに含めることを推奨）。
    // 必要に応じて Cognito Admin API を呼ぶフォールバック実装を追加できるがレイテンシの懸念があるためデフォルトでは実装しない。
    const userId =
      (payload.sub as string) || (payload.username as string) || "";
    const rapidRole = (payload["custom:rapid_role"] ??
      payload["custom_rapid_role"]) as string | undefined;
    const isAdmin =
      typeof rapidRole === "string" && rapidRole.toLowerCase() === "admin";

    request.user = {
      userId,
      isAdmin,
      rawClaims: payload,
      // 互換性のため一部クレームもプロパティとして残す
      sub: payload.sub,
      email: payload.email,
      "cognito:groups": payload["cognito:groups"],
    };
  } catch (error) {
    if (options.required) {
      return reply.code(401).send({
        success: false,
        error: "Invalid or expired token",
      });
    }
  }
}

// FastifyのTypeScriptの型定義を拡張
declare module "fastify" {
  interface FastifyRequest {
    user?: RequestUser;
  }
}
