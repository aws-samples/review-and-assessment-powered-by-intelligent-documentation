import { parameters as rawParameters } from "../lib/parameter";
import { resolveParameters } from "../lib/parameter-schema";

/**
 * availableModels / デフォルトモデルの整合と additive 性
 *
 * 「`availableModels` を変更しても、変更前に含まれていた各モデルの modelId・
 *  displayName・相対順序が保持され（additive）、schema default が期待リストと
 *  一致する」ことを検証する。
 *
 * 2026-07-01 に Claude Sonnet 5 (Global) を先頭（＝既定モデル）に追加し、
 * デフォルトモデルを Sonnet 5 Global へ変更した。model-id-consolidation で
 * documentProcessingModelId / imageReviewModelId を単一の defaultModelId に統合した
 * （旧 2 名は deprecated alias として後方互換で受け付ける）。
 *
 * さらに parameter.ts は「全行コメントアウト・デフォルトから変更する場合のみ
 * コメントを外す」運用に変更した。これによりデフォルト値の単一情報源は
 * parameter-schema.ts となる。本テストは現行の期待リスト `EXPECTED_MODELS` を
 * 固定し、次を検証する:
 *   1. parameter-schema.ts の zod default が EXPECTED_MODELS と完全一致
 *   2. 実効値 resolveParameters({}).availableModels が EXPECTED_MODELS と完全一致
 *   3. 先頭（既定表示に使われる）が Claude Sonnet 5 (Global) である
 *   4. デフォルトモデル ID が availableModels に含まれる（UI で選択肢として解決できる）
 *   5. modelId に重複が無い
 *   6. リポジトリ出荷状態の parameter.ts がモデル設定を上書きしていない
 *      （schema default がそのまま実効値になる）
 *
 * fast-check は CDK の依存に含まれないため、Property を例ベース／パラメトライズド
 * （test.each）テストとして表現する。
 */

interface ModelEntry {
  modelId: string;
  displayName: string;
}

/** 既定モデル（defaultModelId）の期待値。 */
const EXPECTED_DEFAULT_MODEL_ID = "global.anthropic.claude-sonnet-5";

/**
 * parameter-schema.ts の availableModels デフォルト（順序・modelId・
 * displayName まで含めた完全な期待リスト）。
 */
const EXPECTED_MODELS: ReadonlyArray<ModelEntry> = [
  {
    modelId: "global.anthropic.claude-sonnet-5",
    displayName: "Claude Sonnet 5 (Global)",
  },
  {
    modelId: "global.anthropic.claude-opus-4-8",
    displayName: "Claude Opus 4.8 (Global)",
  },
  {
    modelId: "jp.anthropic.claude-opus-4-8",
    displayName: "Claude Opus 4.8 (JP)",
  },
  {
    modelId: "global.anthropic.claude-opus-4-7",
    displayName: "Claude Opus 4.7 (Global)",
  },
  {
    modelId: "jp.anthropic.claude-opus-4-7",
    displayName: "Claude Opus 4.7 (JP)",
  },
  {
    modelId: "global.anthropic.claude-opus-4-6-v1",
    displayName: "Claude Opus 4.6 (Global)",
  },
  {
    modelId: "global.anthropic.claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6 (Global)",
  },
  {
    modelId: "jp.anthropic.claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6 (JP)",
  },
  {
    modelId: "global.anthropic.claude-haiku-4-5-20251001-v1:0",
    displayName: "Claude Haiku 4.5 (Global)",
  },
  {
    modelId: "jp.anthropic.claude-haiku-4-5-20251001-v1:0",
    displayName: "Claude Haiku 4.5 (JP)",
  },
];

/** 先頭（＝既定モデルの表示に使われる）が Sonnet 5 (Global) であることを検証。 */
const EXPECTED_HEAD: ModelEntry = EXPECTED_MODELS[0];

/**
 * availableModels の普遍的性質を検証する:
 * (a) 期待リストと順序・modelId・displayName まで完全一致
 * (b) 先頭が Claude Sonnet 5 (Global)
 * (c) modelId に重複が無い
 * (d) 既定モデル ID が availableModels に含まれる（選択肢として解決可能）
 */
function assertModelList(actual: ModelEntry[]): void {
  // (a) 完全一致
  expect(actual).toEqual(EXPECTED_MODELS);

  // (b) 先頭が Sonnet 5 (Global)
  expect(actual[0]).toEqual(EXPECTED_HEAD);

  // (c) modelId に重複が無い
  const ids = actual.map((m) => m.modelId);
  expect(new Set(ids).size).toBe(ids.length);

  // (d) 既定モデル ID が選択肢に含まれる
  expect(ids).toContain(EXPECTED_DEFAULT_MODEL_ID);
}

describe("availableModels / default model consistency", () => {
  describe("リポジトリ出荷状態の parameter.ts（全行コメントアウト運用）", () => {
    test("モデル関連の設定を上書きしない（schema default がそのまま実効値になる）", () => {
      expect(rawParameters).not.toHaveProperty("availableModels");
      expect(rawParameters).not.toHaveProperty("defaultModelId");
    });
  });

  describe("parameter-schema.ts の availableModels デフォルト配列", () => {
    // availableModels を undefined にすると zod がスキーマ default を適用する。
    const actual = resolveParameters({ availableModels: undefined })
      .availableModels as ModelEntry[];

    test("非空の配列として取得できる", () => {
      expect(Array.isArray(actual)).toBe(true);
      expect(actual.length).toBeGreaterThan(0);
    });

    test("現行の期待リスト（Sonnet 5 先頭）と完全一致し、重複・欠落が無い", () => {
      assertModelList(actual);
    });

    test.each(EXPECTED_MODELS)(
      "モデル %s は modelId・displayName を改変なく保持する",
      (expected) => {
        const match = actual.find((m) => m.modelId === expected.modelId);
        expect(match).toBeDefined();
        expect(match!.displayName).toBe(expected.displayName);
      },
    );
  });

  describe("実効値 resolveParameters({}).availableModels（AVAILABLE_MODELS 供給値）", () => {
    // parameter.ts は上書きしないため、実効値は schema default と一致する。
    const actual = resolveParameters({}).availableModels as ModelEntry[];

    test("非空の配列として取得できる", () => {
      expect(Array.isArray(actual)).toBe(true);
      expect(actual.length).toBeGreaterThan(0);
    });

    test("現行の期待リスト（Sonnet 5 先頭）と完全一致し、重複・欠落が無い", () => {
      assertModelList(actual);
    });

    test("schema default と実効値が一致する（解決で改変されない）", () => {
      const schemaDefault = resolveParameters({ availableModels: undefined })
        .availableModels as ModelEntry[];
      expect(actual).toEqual(schemaDefault);
    });
  });

  describe("既定モデル（defaultModelId）", () => {
    const resolved = resolveParameters({});

    test("実効値の既定モデルが Sonnet 5 (Global) である", () => {
      expect(resolved.defaultModelId).toBe(EXPECTED_DEFAULT_MODEL_ID);
    });

    test("schema default の既定モデルも Sonnet 5 (Global) である", () => {
      const schemaResolved = resolveParameters({
        defaultModelId: undefined,
        documentProcessingModelId: undefined,
        imageReviewModelId: undefined,
      });
      expect(schemaResolved.defaultModelId).toBe(EXPECTED_DEFAULT_MODEL_ID);
    });

    test("既定モデル ID が availableModels の選択肢に含まれる", () => {
      const ids = (resolved.availableModels as ModelEntry[]).map(
        (m) => m.modelId,
      );
      expect(ids).toContain(resolved.defaultModelId);
    });
  });

  // model-id-consolidation: 旧パラメータ名（documentProcessingModelId /
  // imageReviewModelId）は defaultModelId に統合したが、既存デプロイヤーが旧名で
  // 設定した値を無視しないよう deprecated alias として受け付ける。優先順位は
  // defaultModelId > documentProcessingModelId > imageReviewModelId。
  describe("後方互換: 旧パラメータ名の deprecated alias", () => {
    test("defaultModelId 未設定なら documentProcessingModelId を引き継ぐ", () => {
      const resolved = resolveParameters({
        defaultModelId: undefined,
        documentProcessingModelId: "global.anthropic.claude-opus-4-8",
        imageReviewModelId: undefined,
      });
      expect(resolved.defaultModelId).toBe("global.anthropic.claude-opus-4-8");
    });

    test("documentProcessingModelId も未設定なら imageReviewModelId を引き継ぐ", () => {
      const resolved = resolveParameters({
        defaultModelId: undefined,
        documentProcessingModelId: undefined,
        imageReviewModelId: "jp.anthropic.claude-opus-4-7",
      });
      expect(resolved.defaultModelId).toBe("jp.anthropic.claude-opus-4-7");
    });

    test("defaultModelId が明示されていれば旧名より優先される", () => {
      const resolved = resolveParameters({
        defaultModelId: "global.anthropic.claude-sonnet-4-6",
        documentProcessingModelId: "global.anthropic.claude-opus-4-8",
        imageReviewModelId: "jp.anthropic.claude-opus-4-7",
      });
      expect(resolved.defaultModelId).toBe("global.anthropic.claude-sonnet-4-6");
    });
  });
});
