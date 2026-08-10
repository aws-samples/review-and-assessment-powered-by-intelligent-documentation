import type { ModelInfo } from "../types";

/** i18n 文言は呼び出し側から注入し、関数自体は React/i18n 非依存にする。 */
export interface ModelLabelText {
  /** 既定マーカー（既存 `checklist.modelDefault` = "デフォルト"）。 */
  defaultWord: string;
}

/**
 * モデル名表示の単一正規整形器（共有純粋関数）。
 *
 * 出力規約:
 *  - (a) 既知 modelId           → その displayName をそのまま
 *  - (b) 明示なし・既定解決可    → `${defaultWord}: ${defaultDisplayName}`（ラップ括弧を追加しない）
 *  - (c) 明示なし・既定解決不可  → `${defaultWord}`（安定フォールバック・例外を投げない）
 *  - (d) 不明な非空 modelId      → modelId をそのまま（情報欠落回避）
 *
 * いずれの分岐でも整形器が括弧を追加しないため、出力に `((` / `))` の入れ子は生じない。
 * displayName 自身は単一括弧群のみを含むため安全。
 */
export function formatModelLabel(
  modelId: string | null | undefined,
  models: ModelInfo[],
  defaultModelId: string | null,
  text: ModelLabelText
): string {
  const hasExplicit = typeof modelId === "string" && modelId.length > 0;

  if (hasExplicit) {
    const hit = models.find((m) => m.modelId === modelId);
    return hit ? hit.displayName : (modelId as string); // 既知 → displayName / 不明 → 生 id
  }

  // 明示なし → 既定を解決
  const def =
    defaultModelId != null
      ? models.find((m) => m.modelId === defaultModelId)
      : undefined;
  return def ? `${text.defaultWord}: ${def.displayName}` : text.defaultWord;
}
