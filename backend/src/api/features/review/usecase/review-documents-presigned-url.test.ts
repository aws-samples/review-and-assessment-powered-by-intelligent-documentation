import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MAX_REVIEW_DOCUMENTS } from "../../../constants";

vi.mock("../../../core/s3", () => ({
  getPresignedUrl: vi.fn(
    async (_bucket: string, key: string) => `https://s3/${key}`
  ),
  getS3ObjectSize: vi.fn(),
}));

describe("getReviewDocumentsPresignedUrl", () => {
  beforeEach(() => {
    process.env.DOCUMENT_BUCKET = "test-bucket";
  });

  afterEach(() => {
    delete process.env.DOCUMENT_BUCKET;
    vi.clearAllMocks();
  });

  it("returns one presigned URL per filename", async () => {
    const { getReviewDocumentsPresignedUrl } = await import("./review-job");

    const result = await getReviewDocumentsPresignedUrl({
      filenames: ["a.pdf", "b.pdf", "c.pdf"],
      contentTypes: ["application/pdf", "application/pdf", "application/pdf"],
    });

    expect(result.files).toHaveLength(3);
    expect(result.files.map((f) => f.filename)).toEqual([
      "a.pdf",
      "b.pdf",
      "c.pdf",
    ]);
  });

  it("assigns a distinct documentId and key to each file", async () => {
    const { getReviewDocumentsPresignedUrl } = await import("./review-job");

    const result = await getReviewDocumentsPresignedUrl({
      filenames: ["same.pdf", "same.pdf"],
      contentTypes: ["application/pdf", "application/pdf"],
    });

    // 同名ファイルでも上書きされないこと。documentId でキーが分かれる
    const [first, second] = result.files;
    expect(first.documentId).not.toBe(second.documentId);
    expect(first.key).not.toBe(second.key);
  });

  it("stores files under the review document prefix", async () => {
    const { getReviewDocumentsPresignedUrl } = await import("./review-job");

    const result = await getReviewDocumentsPresignedUrl({
      filenames: ["spec.pdf"],
      contentTypes: ["application/pdf"],
    });

    // 画像用(review/images/)ではなくドキュメント用のプレフィックスに置く。
    // 前処理は fileType で PDF/画像を判別するため、置き場所を混ぜない
    expect(result.files[0].key).toMatch(/^review\/original\//);
    expect(result.files[0].key).toContain("spec.pdf");
  });

  it(`rejects more than ${MAX_REVIEW_DOCUMENTS} files`, async () => {
    const { getReviewDocumentsPresignedUrl } = await import("./review-job");

    const over = MAX_REVIEW_DOCUMENTS + 1;
    await expect(
      getReviewDocumentsPresignedUrl({
        filenames: Array.from({ length: over }, (_, i) => `f${i}.pdf`),
        contentTypes: Array.from({ length: over }, () => "application/pdf"),
      })
    ).rejects.toThrow(`Maximum ${MAX_REVIEW_DOCUMENTS} documents allowed`);
  });

  it(`accepts exactly ${MAX_REVIEW_DOCUMENTS} files`, async () => {
    const { getReviewDocumentsPresignedUrl } = await import("./review-job");

    const result = await getReviewDocumentsPresignedUrl({
      filenames: Array.from(
        { length: MAX_REVIEW_DOCUMENTS },
        (_, i) => `f${i}.pdf`
      ),
      contentTypes: Array.from(
        { length: MAX_REVIEW_DOCUMENTS },
        () => "application/pdf"
      ),
    });

    expect(result.files).toHaveLength(MAX_REVIEW_DOCUMENTS);
  });

  it("throws when the bucket is not configured", async () => {
    delete process.env.DOCUMENT_BUCKET;
    const { getReviewDocumentsPresignedUrl } = await import("./review-job");

    await expect(
      getReviewDocumentsPresignedUrl({
        filenames: ["a.pdf"],
        contentTypes: ["application/pdf"],
      })
    ).rejects.toThrow();
  });
});
