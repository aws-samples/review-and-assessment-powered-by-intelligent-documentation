/**
 * エラーハンドラーミドルウェア
 */
import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ApplicationError, ValidationError } from "./application-errors";

/**
 * エラーレスポンスの型
 */
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  errorType?: string;
}

/**
 * エラーハンドラーミドルウェア
 * @param error エラーオブジェクト
 * @param request リクエストオブジェクト
 * @param reply レスポンスオブジェクト
 */
export function errorHandler(
  error: Error | ApplicationError | FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // エラーをログに記録
  request.log.error(error);

  // ValidationErrorの場合
  if (error instanceof ValidationError) {
    reply.code(422).send({
      success: false,
      error: error.message,
    });
    return;
  }

  // ApplicationErrorの場合
  if (error instanceof ApplicationError) {
    const response: ErrorResponse = {
      success: false,
      error: error.message,
    };

    // エラーコードがある場合は追加
    if (error.errorCode) {
      response.code = error.errorCode;
    }

    reply.code(error.statusCode).send(response);
    return;
  }

  // FastifyErrorの場合
  if ((error as FastifyError).statusCode) {
    const fastifyError = error as FastifyError;
    reply.code(fastifyError.statusCode || 500).send({
      success: false,
      error: fastifyError.message,
    });
    return;
  }

  // その他のエラーの場合は500エラー
  reply.code(500).send({
    success: false,
    error: `${error.name}: ${error.message}`,
    errorType: error.name,
  });
}
