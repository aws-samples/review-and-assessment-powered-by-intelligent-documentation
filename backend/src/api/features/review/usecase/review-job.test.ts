import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createReviewJob } from "./review-job";
import { ApplicationError } from "../../../core/errors/application-errors";
import { REVIEW_FILE_TYPE } from "../domain/model/review";
import { sendMessage } from "../../../core/sqs";
import { getS3ObjectSize } from "../../../core/s3";
import { validateFileSize } from "../../../core/file-validation";
import { createInitialReviewJobModel } from "../domain/service/review-job-factory";

vi.mock("../../../core/sqs", () => ({
  sendMessage: vi.fn(),
}));

vi.mock("../../../core/s3", async () => {
  const actual = await vi.importActual<typeof import("../../../core/s3")>(
    "../../../core/s3"
  );
  return {
    ...actual,
    getS3ObjectSize: vi.fn(),
  };
});

vi.mock("../../../core/file-validation", () => ({
  validateFileSize: vi.fn(),
}));

vi.mock("../domain/service/review-job-factory", () => ({
  createInitialReviewJobModel: vi.fn(),
}));

describe("createReviewJob", () => {
  const baseRequestBody = {
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
    userId: "user-456",
    userName: "Test User",
  };

  const envBackup = { ...process.env };
  const checkRepoStub = {} as any;

  beforeEach(() => {
    process.env = { ...envBackup, DOCUMENT_BUCKET: "bucket" };
    vi.mocked(getS3ObjectSize).mockResolvedValue(123);
    vi.mocked(validateFileSize).mockReturnValue(true);
    vi.mocked(createInitialReviewJobModel).mockResolvedValue({
      id: "job-123",
      userId: "user-456",
    });
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.clearAllMocks();
  });

  it("throws when REVIEW_QUEUE_URL is missing", async () => {
    delete process.env.REVIEW_QUEUE_URL;

    await expect(
      createReviewJob({
        requestBody: baseRequestBody,
        deps: {
          checkRepo: checkRepoStub,
          reviewJobRepo: {
            createReviewJob: vi.fn(),
          },
        },
      })
    ).rejects.toBeInstanceOf(ApplicationError);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends a queue message with the review job id as group id", async () => {
    process.env.REVIEW_QUEUE_URL = "https://sqs.example/queue";

    const createReviewJobRepo = {
      createReviewJob: vi.fn(),
    };

    await createReviewJob({
      requestBody: baseRequestBody,
      deps: {
        checkRepo: checkRepoStub,
        reviewJobRepo: createReviewJobRepo,
      },
    });

    expect(sendMessage).toHaveBeenCalledWith(
      "https://sqs.example/queue",
      {
        reviewJobId: "job-123",
        userId: "user-456",
      },
      "job-123"
    );
    expect(createReviewJobRepo.createReviewJob).toHaveBeenCalled();
  });
});
