import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { ModelInfo } from "../types";
import { formatModelLabel, type ModelLabelText } from "./modelLabel";

/**
 * Model label formatting
 *
 * formatModelLabel は表示用ラベルを次の 4 分岐で決定的に整形する。整形器は
 * いかなる分岐でも「追加のラップ括弧」を付けないため、入力自体がネスト括弧
 * (`((` / `))`) を含まない限り、出力にもネスト括弧は生じない。
 *
 *  - (a) 既知 modelId           → その displayName をそのまま
 *  - (b) 明示なし・既定解決可    → `${defaultWord}: ${defaultDisplayName}`
 *  - (c) 明示なし・既定解決不可  → `${defaultWord}`
 *  - (d) 不明な非空 modelId      → modelId をそのまま
 *
 * 本テストは「整形器がネスト括弧を導入しない」ことを検証するため、すべての文字列
 * 入力をネスト括弧を含まない (単一括弧群は許容する) ように制約する。RAPID の実際の
 * displayName は `Claude Opus 4.7 (Global)` のように単一括弧群のみを含むため、この
 * 制約は実データの前提と一致する。
 */

/** ネスト括弧 `((` / `))` を含まないことを判定するヘルパ。 */
const hasNoNestedParens = (s: string): boolean =>
  !s.includes("((") && !s.includes("))");

/**
 * displayName のジェネレータ。
 * - 意図的に `(Global)` 等の単一括弧群を含む curated 値を混ぜる (二重括弧回避の検証の核心)。
 * - ランダム文字列も混ぜるが、ネスト括弧 `((` / `))` を含むものは除外する
 *   (整形器の不変条件は「displayName 自身が単一括弧群のみ」を前提とするため)。
 */
const arbDisplayName: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(
    "Claude Opus 4.7 (Global)",
    "Claude Sonnet 4 (Global)",
    "Amazon Nova Pro",
    "GPT-4o",
    "Model (US) (beta)", // 複数の単一括弧群を持つが `((` / `))` は無い
    "" // 空 displayName エッジ
  ),
  fc.string().filter(hasNoNestedParens)
);

/**
 * modelId / defaultModelId に使う「非空・ネスト括弧なし」文字列。
 * 現実の id は括弧を含まないため、括弧そのものを除外して realistic に保つ。
 */
const arbNonEmptyId: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(
    "global.anthropic.claude-sonnet-4-20250514-v1:0",
    "us.amazon.nova-pro-v1:0",
    "anthropic.claude-3-haiku-20240307-v1:0"
  ),
  fc
    .string({ minLength: 1 })
    .filter((s) => s.length > 0 && !s.includes("(") && !s.includes(")"))
);

/** defaultWord (i18n の "デフォルト" 相当)。空文字も含め、ネスト括弧は除外。 */
const arbDefaultWord: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom("デフォルト", "Default", ""),
  fc.string().filter(hasNoNestedParens)
);

const arbModels: fc.Arbitrary<ModelInfo[]> = fc.array(
  fc.record({ modelId: arbNonEmptyId, displayName: arbDisplayName }),
  { maxLength: 6 }
);

/**
 * 1 ケース分の入力 (models / modelId / defaultModelId / defaultWord) を生成する。
 * models に依存して「既知 id」を選ぶため fc.chain で段階生成する。modelId は
 * fc.oneof(既知 id, null, undefined, "", 一覧外の非空 id) を、defaultModelId は
 * fc.oneof(既知 id, null, 一覧外 id) を網羅し、(a)〜(d) の全分岐を踏む。
 */
const arbCase = arbModels.chain((models) => {
  const knownIds = models.map((m) => m.modelId);

  const modelIdArb: fc.Arbitrary<string | null | undefined> = fc.oneof(
    ...(knownIds.length > 0 ? [fc.constantFrom(...knownIds)] : []),
    fc.constant(null),
    fc.constant(undefined),
    fc.constant(""),
    arbNonEmptyId // 多くの場合は一覧外 (分岐 d)。偶発的に一致しても oracle が吸収する
  );

  const defaultModelIdArb: fc.Arbitrary<string | null> = fc.oneof(
    ...(knownIds.length > 0 ? [fc.constantFrom(...knownIds)] : []),
    fc.constant(null),
    arbNonEmptyId // 一覧外 id → 既定解決不可 (分岐 c) を踏む
  );

  return fc.record({
    models: fc.constant(models),
    modelId: modelIdArb,
    defaultModelId: defaultModelIdArb,
    defaultWord: arbDefaultWord,
  });
});

/**
 * 独立 oracle: 出力規約をそのまま再記述する。`Array.prototype.find`
 * (標準ライブラリ) のみを使い、実装の find 一致セマンティクス (最初の一致を採用) を
 * 反映する。実装と同じ規約を別実装で書くことで分岐の期待値を固定する。
 */
const expectedLabel = (
  modelId: string | null | undefined,
  models: ModelInfo[],
  defaultModelId: string | null,
  defaultWord: string
): string => {
  const hasExplicit = typeof modelId === "string" && modelId.length > 0;
  if (hasExplicit) {
    const hit = models.find((m) => m.modelId === modelId);
    return hit ? hit.displayName : (modelId as string);
  }
  const def =
    defaultModelId != null
      ? models.find((m) => m.modelId === defaultModelId)
      : undefined;
  return def ? `${defaultWord}: ${def.displayName}` : defaultWord;
};

describe("formatModelLabel", () => {
  it("never throws, never introduces nested parens, and matches the documented (a)-(d) branches", () => {
    fc.assert(
      fc.property(
        arbCase,
        ({ models, modelId, defaultModelId, defaultWord }) => {
          const text: ModelLabelText = { defaultWord };

          // (0) 例外を投げない (要件: 安定フォールバック)
          let out!: string;
          expect(() =>
            formatModelLabel(modelId, models, defaultModelId, text)
          ).not.toThrow();
          out = formatModelLabel(modelId, models, defaultModelId, text);

          // 出力は常に string
          expect(typeof out).toBe("string");

          // 整形器はラップ括弧を追加しないため、ネスト括弧は生じない
          expect(out.includes("((")).toBe(false);
          expect(out.includes("))")).toBe(false);

          // documented な (a)〜(d) 分岐の期待値と一致する
          expect(out).toBe(
            expectedLabel(modelId, models, defaultModelId, defaultWord)
          );

          // 各分岐ごとの構造的な不変条件を独立に確認する
          const hasExplicit = typeof modelId === "string" && modelId.length > 0;
          if (hasExplicit) {
            const hit = models.find((m) => m.modelId === modelId);
            if (hit) {
              // (a) 既知 id → displayName 直返し (装飾なし)
              expect(out).toBe(hit.displayName);
            } else {
              // (d) 不明な非空 id → 生 id 直返し (情報欠落回避)
              expect(out).toBe(modelId);
            }
          } else {
            const def =
              defaultModelId != null
                ? models.find((m) => m.modelId === defaultModelId)
                : undefined;
            if (def) {
              // (b) 既定解決可 → `${defaultWord}: ${defaultDisplayName}`
              expect(out).toBe(`${defaultWord}: ${def.displayName}`);
              expect(out.startsWith(`${defaultWord}: `)).toBe(true);
              expect(out.endsWith(def.displayName)).toBe(true);
            } else {
              // (c) 既定解決不可 → defaultWord (安定フォールバック)
              expect(out).toBe(defaultWord);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('a displayName containing a single parenthesis group (e.g. "(Global)") is returned verbatim without being wrapped into nested parens', () => {
    const arb = fc.record({
      modelId: arbNonEmptyId,
      displayName: fc.constantFrom(
        "Claude Opus 4.7 (Global)",
        "Claude Sonnet 4 (Global)",
        "Model (US) (beta)"
      ),
      defaultWord: arbDefaultWord,
    });

    fc.assert(
      fc.property(arb, ({ modelId, displayName, defaultWord }) => {
        const models: ModelInfo[] = [{ modelId, displayName }];
        const text: ModelLabelText = { defaultWord };

        // 既知 id (分岐 a): displayName をそのまま返し、追加括弧で包まない
        const knownOut = formatModelLabel(modelId, models, null, text);
        expect(knownOut).toBe(displayName);
        expect(knownOut.includes("((")).toBe(false);
        expect(knownOut.includes("))")).toBe(false);

        // 既定解決 (分岐 b): `${defaultWord}: ${displayName}` で単一括弧のまま
        const defaultOut = formatModelLabel(null, models, modelId, text);
        expect(defaultOut).toBe(`${defaultWord}: ${displayName}`);
        expect(defaultOut.includes("((")).toBe(false);
        expect(defaultOut.includes("))")).toBe(false);
      }),
      { numRuns: 200 }
    );
  });
});
