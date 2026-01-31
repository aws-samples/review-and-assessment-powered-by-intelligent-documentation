/**
 * Fastifyアプリケーションの作成
 */
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import responseLogger from "../core/plugins/response-logger";

/**
 * Fastifyアプリケーションを作成する
 * @returns Fastifyインスタンス
 */
export function createApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  // CORSの設定
  app.register(cors, {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // レスポンスロガープラグインを登録
  app.register(responseLogger, {
    logLevel: "info",
  });

  // 空のJSONボディを処理するためのカスタムパーサーを追加
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      if (body === "" || body === null) {
        done(null, {});
      } else {
        // 既存のパーサーを使用して処理
        try {
          const json = JSON.parse(body as string);
          done(null, json);
        } catch (err) {
          done(err as Error, undefined);
        }
      }
    }
  );

  // ヘルスチェックエンドポイント
  app.get("/health", async (_, reply) => {
    reply.code(200).send({ status: "ok" });
  });

  // 認証情報確認エンドポイント
  app.get("/auth/me", async (request, reply) => {
    reply.code(200).send({
      success: true,
      data: {
        user: request.user,
      },
    });
  });

  return app;
}
