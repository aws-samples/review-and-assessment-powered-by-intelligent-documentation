import { ForbiddenError } from "../../core/errors/application-errors";

/**
 * リクエストに含まれるユーザー情報の最小型
 */
export type RequestUser = {
  userId: string;
  isAdmin: boolean;
  rawClaims?: Record<string, any>;
  // 既存のクレームも参照できるようにオプションで保持
  sub?: string;
  email?: string;
  [key: string]: any;
};

/**
 * 所有者アクセスの判定
 * - 管理者(isAdmin)は常にtrue
 * - それ以外は userId === resourceOwnerId を比較
 */
export function hasOwnerAccess(
  user: RequestUser | undefined | null,
  resourceOwnerId: string | undefined | null
): boolean {
  if (!user || !resourceOwnerId) return false;
  if (user.isAdmin) return true;
  return user.userId === resourceOwnerId;
}

/**
 * 所有者アクセスを検証し、許可されていなければ ForbiddenError を投げる。
 * オプションでログ出力用の情報(api名, resourceId, logger)を受け取るとログ出力を行う。
 */
export function assertHasOwnerAccessOrThrow(
  user: RequestUser | undefined | null,
  resourceOwnerId: string | undefined | null,
  opts?: {
    api?: string;
    resourceId?: string;
    logger?: {
      warn?: (...args: any[]) => void;
      warning?: (...args: any[]) => void;
    };
  }
): void {
  const allowed = hasOwnerAccess(user, resourceOwnerId);
  if (!allowed) {
    // ログ出力（ある場合のみ）
    try {
      const api = opts?.api || "unknown_api";
      const resourceId =
        opts?.resourceId || resourceOwnerId || "unknown_resource";
      const userId = user?.userId || "unknown_user";
      const logger = opts?.logger;
      const message = `Failure to authorize. : api=${api}, user_id=${userId}, resource_id=${resourceId}`;
      if (logger?.warn) {
        logger.warn(message);
      } else if (logger?.warning) {
        logger.warning(message);
      }
    } catch (e) {
      // ログは補助的。失敗しても処理は継続して例外を投げる
    }
    throw new ForbiddenError("Access to the requested resource is forbidden");
  }
}
