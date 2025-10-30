/**
 * アプリケーションエラー基底クラス
 */
export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly errorCode?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * リソースが見つからないエラー
 */
export class NotFoundError extends ApplicationError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 404, "NOT_FOUND");
  }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends ApplicationError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

/**
 * ファイルサイズ超過エラー
 */
export class FileSizeExceededError extends ValidationError {
  public readonly filename: string;
  public readonly actualSize: number;
  public readonly maxSize: number;

  constructor(filename: string, actualSize: number, maxSize: number) {
    const formatFileSize = (bytes: number): string => {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const message = `File "${filename}" (${formatFileSize(actualSize)}) exceeds maximum size limit of ${formatFileSize(maxSize)}`;
    super(message);
    this.filename = filename;
    this.actualSize = actualSize;
    this.maxSize = maxSize;
  }
}

/**
 * 権限エラー
 */
export class ForbiddenError extends ApplicationError {
  constructor(message: string) {
    super(message, 403, "FORBIDDEN");
  }
}

/**
 * 関連リソースが存在するため操作できないエラー
 */
export class LinkedResourceError extends ApplicationError {
  constructor(message: string) {
    super(message, 400, "LINKED_RESOURCE");
  }
}

/**
 * チェックリスト関連のエラー
 */
export class ChecklistError extends ApplicationError {
  constructor(message: string, errorCode: string) {
    super(message, 400, errorCode);
  }
}

/**
 * 審査関連のエラー
 */
export class ReviewError extends ApplicationError {
  constructor(message: string, errorCode: string) {
    super(message, 400, errorCode);
  }
}

/**
 * ドキュメント関連のエラー
 */
export class DocumentError extends ApplicationError {
  constructor(message: string, errorCode: string) {
    super(message, 400, errorCode);
  }
}
