import type { PrismaClient } from "@prisma/client";
import {
  THRESHOLDS,
  ConcurrencyThreshold,
} from "../../../../config/concurrency";
import type { ReviewJobRepository } from "../domain/repository";
import { getQueueDepth } from "../../../core/sqs";

import { Logger } from "@aws-lambda-powertools/logger";

const serviceName = __filename; // 拡張子を除いたファイル名
const logger = new Logger({ serviceName });

export const computeGlobalConcurrency = async (): Promise<{
  isLimit: boolean;
}> => {
  logger.info("computeGlobalConcurrency called");
  // グローバル同時実行数チェック（SQSキュー深さ確認）
  const queueUrl = process.env.REVIEW_SQS_URL;
  const globalLimit = Number(process.env.REVIEW_GLOBAL_CONCURRENCY_LIMIT ?? 0);

  if (queueUrl && globalLimit > 0) {
    try {
      const depth = await getQueueDepth(queueUrl);
      logger.info("SQS queue depth fetched", { queueUrl, depth });
      if (depth.total >= globalLimit) {
        logger.warn("Global concurrency limit reached", { depth, globalLimit });
        return { isLimit: true };
      }
    } catch (e) {
      // エラーはログに出すだけで処理継続（最小変更重視）
      logger.error("Failed to check global concurrency:", e as Error);
    }
  }
  logger.info("Global concurrency check passed");
  return { isLimit: false };
};
/**
 * 審査履歴の集計（calcReviewHistory）
 * - ユーザの審査実行件数を集計し、各ウィンドウごとのカウントと閾値超過フラグを返す
 *   (a) nextAllowedAt は errorLimit を満たしたウィンドウ群について、各ウィンドウで算出される nextAllowedAt の中で最も遅いものを返す
 *   (b) warningLimit を満たす場合は、閾値のみを返す（ジョブは実行される）
 *
 * 返却オブジェクト:
 * {
 *   userId,
 *   nowUtc,
 *   nextAllowedAt: string | null,             // ブロック時に設定
 *   blockingThreshold: { windowHours, errorLimit } | null, // ブロック時に設定
 *   warningThreshold: { windowHours, warningLimit } | null // 警告時に設定
 * }
 */

export const computeConcurrencyForUser = async (params: {
  userId: string;
  deps?: {
    repo?: ReviewJobRepository;
    client?: PrismaClient | null;
    thresholds?: ConcurrencyThreshold[];
  };
}): Promise<{
  userId: string;
  nowUtc: string;
  thresholds: ConcurrencyThreshold[];
  counts: {
    windowHours: number;
    count: number;
    warningExceeded: boolean;
    errorExceeded: boolean;
  }[];
  nextAllowedAt: string | null;
  blockingThreshold: { windowHours: number; errorLimit: number } | null;
}> => {
  logger.info("computeConcurrencyForUser called", { userId: params.userId });

  const { userId, deps } = params;

  const nowUtc = new Date();

  const thresholds = deps?.thresholds ?? THRESHOLDS;

  // 閾値が設定されていない場合は空の結果を返す（制限なし）
  if (!thresholds || thresholds.length === 0) {
    logger.info("No concurrency thresholds set, returning no limits", {
      userId,
    });
    return {
      userId,
      nowUtc: nowUtc.toISOString(),
      thresholds: [],
      counts: [],
      nextAllowedAt: null,
      blockingThreshold: null,
    };
  }

  let repo: ReviewJobRepository | undefined = deps?.repo;
  if (!repo) {
    const { makePrismaReviewJobRepository } = await import(
      "../domain/repository"
    );
    repo = await makePrismaReviewJobRepository(deps?.client ?? null);
  }

  const maxWindowHours = Math.max(...thresholds.map((t) => t.windowHours));
  const since = new Date(nowUtc.getTime() - maxWindowHours * 60 * 60 * 1000);

  // 審査実行数取得
  const jobs = await repo.findReviewJobsByUserSince({
    userId,
    since,
  });

  // 審査履歴はレコード作成日時の昇順でソート
  const errorExceededWindows: {
    windowHours: number;
    errorLimit: number;
    nextAllowedAt: Date;
  }[] = [];

  const counts: {
    windowHours: number;
    count: number;
    warningExceeded: boolean;
    errorExceeded: boolean;
  }[] = [];

  for (const t of thresholds as ConcurrencyThreshold[]) {
    const windowStart = new Date(
      nowUtc.getTime() - t.windowHours * 60 * 60 * 1000
    );
    const collect = jobs.filter((j) => j.createdAt >= windowStart);

    // DBから取得した過去の実行件数に、今回の試行分を加えた値で閾値判定を行う
    const dbCount = collect.length;
    const count = dbCount + 1;

    const errorExceeded = t.errorLimit > 0 ? count >= t.errorLimit : false;
    const warningExceeded =
      t.warningLimit > 0 ? count >= t.warningLimit : false;

    // 内部・運用向けにウィンドウ毎のカウントと閾値超過フラグを収集する
    counts.push({
      windowHours: t.windowHours,
      count,
      warningExceeded,
      errorExceeded,
    });

    if (errorExceeded) {
      // errorLimit 番目に該当する createdAt を特定し、そこから再実行可能時刻を算出する
      const idx = count - t.errorLimit;
      if (idx >= 0 && idx < collect.length) {
        const thatCreatedAt = collect[idx].createdAt;
        const nextAllowedAt = new Date(
          thatCreatedAt.getTime() + t.windowHours * 60 * 60 * 1000
        );
        errorExceededWindows.push({
          windowHours: t.windowHours,
          errorLimit: t.errorLimit,
          nextAllowedAt,
        });
      } else {
        // インデックスが範囲外の場合はこのウィンドウをスキップする
        continue;
      }
    }
  }

  // errorLimit を超えたウィンドウが存在する場合、各ウィンドウの nextAllowedAt のうち最も遅いものを採用してブロック情報を返す
  if (errorExceededWindows.length > 0) {
    let latest = errorExceededWindows[0];
    for (const w of errorExceededWindows) {
      if (w.nextAllowedAt.getTime() > latest.nextAllowedAt.getTime()) {
        latest = w;
      }
    }
    logger.info("Concurrency limit exceeded, blocking user", {
      userId,
      latest,
    });
    return {
      userId,
      nowUtc: nowUtc.toISOString(),
      thresholds,
      counts,
      nextAllowedAt: latest.nextAllowedAt.toISOString(),
      blockingThreshold: {
        windowHours: latest.windowHours,
        errorLimit: latest.errorLimit,
      },
    };
  }

  // 審査実行数と閾値を返す
  logger.info("Concurrency check passed", { userId });
  return {
    userId,
    nowUtc: nowUtc.toISOString(),
    thresholds,
    counts,
    nextAllowedAt: null,
    blockingThreshold: null,
  };
};
