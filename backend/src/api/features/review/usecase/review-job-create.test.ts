import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendMessage } = vi.hoisted(() => ({ sendMessage: vi.fn() }));

vi.mock("../../../core/sqs", () => ({
  sendMessage,
  getQueueDepth: vi.fn(),
}));

vi.mock("../../../core/s3", () => ({
  getPresignedUrl: vi.fn(),
  getS3ObjectSize: vi.fn().mockResolvedValue(1024),
}));

import { createReviewJob } from "./review-job";
import { REVIEW_FILE_TYPE, REVIEW_JOB_STATUS } from "../domain/model/review";
import type { ReviewJobRepository } from "../domain/repository";
import type { CheckRepository } from "../../checklist/domain/repository";

const requestBody = {
  name: "job",
  checkListSetId: "set-1",
  documents: [
    {
      id: "doc-1",
      filename: "spec.pdf",
      s3Key: "review/original/doc-1/spec.pdf",
      fileType: REVIEW_FILE_TYPE.PDF,
    },
  ],
  userId: "user-1",
};

const deps = () => ({
  checkRepo: {
    findCheckListItems: vi
      .fn()
      .mockResolvedValue([
        { id: "A", setId: "set-1", name: "A", hasChildren: false },
      ]),
  } as unknown as CheckRepository,
  reviewJobRepo: {
    createReviewJob: vi.fn().mockResolvedValue(undefined),
    updateJobStatus: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReviewJobRepository,
});

describe("createReviewJob", () => {
  beforeEach(() => {
    sendMessage.mockReset();
    process.env.DOCUMENT_BUCKET = "bucket";
    process.env.REVIEW_QUEUE_URL = "https://sqs.example/queue";
  });

  it("saves the job before queueing it", async () => {
    // The review workflow starts as soon as the message arrives and updates
    // the job, so the job has to exist by then.
    sendMessage.mockResolvedValue(undefined);
    const d = deps();

    await createReviewJob({ requestBody, deps: d });

    const saved = vi.mocked(d.reviewJobRepo.createReviewJob);
    expect(saved).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(saved.mock.invocationCallOrder[0]).toBeLessThan(
      sendMessage.mock.invocationCallOrder[0]
    );
    const jobId = saved.mock.calls[0][0].id;
    expect(sendMessage).toHaveBeenCalledWith(
      "https://sqs.example/queue",
      { reviewJobId: jobId, userId: "user-1" },
      jobId
    );
  });

  it("marks the job as failed when it cannot be queued", async () => {
    sendMessage.mockRejectedValue(new Error("SQS unavailable"));
    const d = deps();

    await expect(createReviewJob({ requestBody, deps: d })).rejects.toThrow(
      "SQS unavailable"
    );

    const jobId = vi.mocked(d.reviewJobRepo.createReviewJob).mock.calls[0][0]
      .id;
    expect(d.reviewJobRepo.updateJobStatus).toHaveBeenCalledWith({
      reviewJobId: jobId,
      status: REVIEW_JOB_STATUS.FAILED,
      errorDetail: "Failed to queue the review job",
    });
  });

  it("still reports the queueing error if marking the job fails too", async () => {
    sendMessage.mockRejectedValue(new Error("SQS unavailable"));
    const d = deps();
    vi.mocked(d.reviewJobRepo.updateJobStatus).mockRejectedValue(
      new Error("database unavailable")
    );

    await expect(createReviewJob({ requestBody, deps: d })).rejects.toThrow(
      "SQS unavailable"
    );
  });

  it("does not queue a job that could not be saved", async () => {
    const d = deps();
    vi.mocked(d.reviewJobRepo.createReviewJob).mockRejectedValue(
      new Error("database unavailable")
    );

    await expect(createReviewJob({ requestBody, deps: d })).rejects.toThrow(
      "database unavailable"
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
