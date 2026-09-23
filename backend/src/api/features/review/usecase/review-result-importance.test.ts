import { describe, it, expect, vi } from "vitest";
import { getReviewResults } from "./review-result";
import { ValidationError } from "../../../core/errors/application-errors";

const owner = { userId: "owner-1", isAdmin: false };

const makeDeps = () => ({
  repo: { findReviewResultsById: vi.fn().mockResolvedValue([]) },
  reviewJobRepo: {
    findReviewJobById: vi
      .fn()
      .mockResolvedValue({ id: "job-1", userId: "owner-1" }),
  },
});

describe("getReviewResults importance filter", () => {
  it("passes the importance to the repository", async () => {
    const deps = makeDeps();

    await getReviewResults({
      reviewJobId: "job-1",
      importance: "high",
      user: owner,
      deps: deps as any,
    });

    expect(deps.repo.findReviewResultsById).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", importance: "high" })
    );
  });

  it("does not filter by importance when none is given", async () => {
    const deps = makeDeps();

    await getReviewResults({
      reviewJobId: "job-1",
      user: owner,
      deps: deps as any,
    });

    expect(
      deps.repo.findReviewResultsById.mock.calls[0][0].importance
    ).toBeUndefined();
  });

  it("rejects an unknown importance", async () => {
    const deps = makeDeps();

    await expect(
      getReviewResults({
        reviewJobId: "job-1",
        importance: "urgent",
        user: owner,
        deps: deps as any,
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(deps.repo.findReviewResultsById).not.toHaveBeenCalled();
  });
});
