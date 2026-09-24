import { describe, expect, it, vi } from "vitest";

/**
 * 合否で絞り込んだときに、どの項目を返すか。
 *
 * 画面は階層を1段ずつ読み込むので、条件に合う項目にたどり着けるよう祖先も
 * 返す必要がある。一方で、条件に合う子の無い親まで返すと、中身の無い親が
 * 並ぶ（既定の「不合格」表示に、合格しか無い親が出る）。
 */
type Row = {
  checkId: string;
  parentId: string | null;
  result: "pass" | "fail" | null;
  status?: string;
};

const makeClient = (rows: Row[]) => {
  const seen: { where?: any } = {};
  const findMany = vi.fn(async (args: any) => {
    // 絞り込みのために全件を軽く読む呼び出し
    if (args.select?.checkId) {
      return rows.map((r) => ({
        checkId: r.checkId,
        status: r.status ?? "completed",
        result: r.result,
        checkList: { parentId: r.parentId },
      }));
    }
    // 画面に返す結果を読む呼び出し
    if (args.include?.checkList) {
      seen.where = args.where;
    }
    return [];
  });
  return {
    seen,
    client: {
      reviewResult: { findMany, count: vi.fn().mockResolvedValue(0) },
      checkList: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };
};

const loadRepository = async (client: unknown) => {
  vi.resetModules();
  vi.doMock("../../../core/db", () => ({
    getPrismaClient: async () => client,
  }));
  const module = await import("./repository");
  return module.makePrismaReviewResultRepository(client as never);
};

const returnedIds = async (rows: Row[], filter?: "pass" | "fail") => {
  const { seen, client } = makeClient(rows);
  const repo = await loadRepository(client);
  await repo.findReviewResultsById({
    jobId: "job-1",
    filter: filter as never,
    includeAllChildren: false,
  });
  return seen.where?.checkId?.in
    ? [...seen.where.checkId.in].sort()
    : undefined;
};

// 親 P1: 合格と不合格が混在（親は不合格） / 親 P2: 不合格のみ / 親 P3: 合格のみ
const TREE: Row[] = [
  { checkId: "P1", parentId: null, result: "fail" },
  { checkId: "C1", parentId: "P1", result: "pass" },
  { checkId: "C2", parentId: "P1", result: "fail" },
  { checkId: "P2", parentId: null, result: "fail" },
  { checkId: "C3", parentId: "P2", result: "fail" },
  { checkId: "P3", parentId: null, result: "pass" },
  { checkId: "C4", parentId: "P3", result: "pass" },
  { checkId: "L1", parentId: null, result: "pass" },
];

describe("合否で絞り込んだときに返す項目", () => {
  it("合格で絞ると、混在の親から合格の子にたどり着ける", async () => {
    expect(await returnedIds(TREE, "pass")).toEqual(
      ["C1", "C4", "L1", "P1", "P3"].sort()
    );
  });

  it("合格で絞ると、合格の子を持たない親は返さない", async () => {
    const ids = await returnedIds(TREE, "pass");
    expect(ids).not.toContain("P2");
    expect(ids).not.toContain("C2");
  });

  it("不合格で絞ると、合格しか持たない親は返さない", async () => {
    // 既定の「不合格」表示に、中身の無い親が並ばないこと
    expect(await returnedIds(TREE, "fail")).toEqual(
      ["C2", "C3", "P1", "P2"].sort()
    );
  });

  it("何段下にあっても、条件に合う項目の祖先をすべて返す", async () => {
    const rows: Row[] = [
      { checkId: "G", parentId: null, result: "fail" },
      { checkId: "P", parentId: "G", result: "fail" },
      { checkId: "C", parentId: "P", result: "pass" },
      { checkId: "D", parentId: "P", result: "fail" },
    ];
    expect(await returnedIds(rows, "pass")).toEqual(["C", "G", "P"]);
  });

  it("審査が終わっていない項目は、判定が無いので絞り込みで返さない", async () => {
    const rows: Row[] = [
      { checkId: "A", parentId: null, result: null, status: "processing" },
      { checkId: "B", parentId: null, result: "pass" },
    ];
    expect(await returnedIds(rows, "pass")).toEqual(["B"]);
  });

  it("絞り込まないときは、項目で絞る条件を足さない", async () => {
    expect(await returnedIds(TREE, undefined)).toBeUndefined();
  });
});
