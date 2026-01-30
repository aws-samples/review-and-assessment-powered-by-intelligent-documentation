import { describe, it, expect, vi, beforeEach } from "vitest";
import { createReviewJobHandler } from "./handlers";
import {
  computeGlobalConcurrency,
  createReviewJob,
} from "../usecase/review-job";
import { REVIEW_FILE_TYPE } from "../domain/model/review";

vi.mock("../usecase/review-job", () => ({
  computeGlobalConcurrency: vi.fn(),
  createReviewJob: vi.fn(),
}));

describe("createReviewJobHandler", () => {
  const requestBody = {
    name: "review",
    checkListSetId: "checklist-1",
    documents: [
      {
        id: "doc-1",
        filename: "doc.pdf",
        s3Key: "uploads/doc.pdf",
        fileType: REVIEW_FILE_TYPE.PDF,
      },
    ],
  };

  const makeReply = () => ({
    code: vi.fn().mockReturnThis(),
    send: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 when global concurrency limit is reached", async () => {
    vi.mocked(computeGlobalConcurrency).mockResolvedValue({ isLimit: true });
    const reply = makeReply();

    await createReviewJobHandler(
      {
        body: requestBody,
      } as any,
      reply as any
    );

    expect(reply.code).toHaveBeenCalledWith(429);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: "System is busy",
      code: "REVIEW_GLOBAL_CONCURRENCY_EXCEEDED",
      data: {},
    });
    expect(createReviewJob).not.toHaveBeenCalled();
  });

  it("creates review job when under the limit", async () => {
    vi.mocked(computeGlobalConcurrency).mockResolvedValue({ isLimit: false });
    const reply = makeReply();

    await createReviewJobHandler(
      {
        body: requestBody,
        user: { sub: "user-123" },
      } as any,
      reply as any
    );

    expect(createReviewJob).toHaveBeenCalledWith({
      requestBody: {
        ...requestBody,
        userId: "user-123",
      },
    });
    expect(reply.code).toHaveBeenCalledWith(201);
  });
});
