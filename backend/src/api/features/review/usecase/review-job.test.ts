import { describe, it, expect, vi } from "vitest";
import { getAllReviewJobs } from "./review-job";
import type { PaginatedResponse } from "../../../common/types";
import type { ReviewJobSummary } from "../domain/model/review";
import type { ReviewJobRepository } from "../domain/repository";

const emptyResult: PaginatedResponse<ReviewJobSummary> = {
  items: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0,
};

const createReviewJobRepositoryMock = (): ReviewJobRepository => ({
  findAllReviewJobs: vi.fn().mockResolvedValue(emptyResult),
  findReviewJobById: vi.fn(),
  createReviewJob: vi.fn(),
  deleteReviewJobById: vi.fn(),
  updateJobStatus: vi.fn(),
  updateJobCostInfo: vi.fn(),
});

describe("getAllReviewJobs", () => {
  it("passes ownerUserId for non-admin users", async () => {
    const repo = createReviewJobRepositoryMock();

    await getAllReviewJobs({
      page: 1,
      limit: 10,
      user: { userId: "user-1", isAdmin: false },
      deps: { repo },
    });

    expect(repo.findAllReviewJobs).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: "user-1" })
    );
  });

  it("does not pass ownerUserId for admin users", async () => {
    const repo = createReviewJobRepositoryMock();

    await getAllReviewJobs({
      page: 1,
      limit: 10,
      user: { userId: "admin-1", isAdmin: true },
      deps: { repo },
    });

    expect(repo.findAllReviewJobs).toHaveBeenCalledWith(
      expect.not.objectContaining({ ownerUserId: "admin-1" })
    );
  });
});
