import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock factories (hoisted to avoid vi.mock initialization issues) ---

const {
  mockReviewJobRepo,
  mockCheckRepo,
  mockUserPrefRepo,
  mockToolConfigRepo,
} = vi.hoisted(() => ({
  mockReviewJobRepo: {
    findReviewJobById: vi.fn(),
  },
  mockCheckRepo: {
    findCheckListItemById: vi.fn(),
  },
  mockUserPrefRepo: {
    getUserPreference: vi.fn(),
  },
  mockToolConfigRepo: {
    findById: vi.fn(),
  },
}));

vi.mock("../../api/features/review/domain/repository", () => ({
  makePrismaReviewJobRepository: vi.fn().mockResolvedValue(mockReviewJobRepo),
}));

vi.mock("../../api/features/checklist/domain/repository", () => ({
  makePrismaCheckRepository: vi.fn().mockResolvedValue(mockCheckRepo),
}));

vi.mock("../../api/features/user-preference/domain/repository", () => ({
  makePrismaUserPreferenceRepository: vi
    .fn()
    .mockResolvedValue(mockUserPrefRepo),
}));

vi.mock("../../api/features/tool-configuration/domain/repository", () => ({
  makePrismaToolConfigurationRepository: vi
    .fn()
    .mockResolvedValue(mockToolConfigRepo),
}));

import { preReviewItemProcessor } from "../review-preprocessing/pre-review-item";

// --- Helpers ---

const makeJobDetail = (overrides?: Partial<{ documents: any[] }>) => ({
  id: "job-1",
  name: "Test Job",
  status: "processing",
  documents: [
    {
      id: "doc-1",
      filename: "test.pdf",
      s3Path: "s3://bucket/test.pdf",
      fileType: "pdf",
    },
  ],
  ...overrides,
});

const makeCheckListItem = (overrides?: Record<string, unknown>) => ({
  id: "check-1",
  name: "Check Item",
  description: "Check description",
  toolConfigurationId: null,
  modelId: undefined,
  feedbackSummary: null,
  ...overrides,
});

describe("preReviewItemProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserPrefRepo.getUserPreference.mockResolvedValue(null);
    // テスト用の availableModels を設定
    vi.stubEnv(
      "AVAILABLE_MODELS",
      JSON.stringify([
        {
          modelId: "anthropic.claude-sonnet-4",
          displayName: "Claude Sonnet 4",
        },
        { modelId: "model-x", displayName: "Model X" },
      ])
    );
  });

  it("includes modelId in output when checkList has modelId set", async () => {
    mockReviewJobRepo.findReviewJobById.mockResolvedValue(makeJobDetail());
    mockCheckRepo.findCheckListItemById.mockResolvedValue(
      makeCheckListItem({ modelId: "anthropic.claude-sonnet-4" })
    );

    const result = await preReviewItemProcessor({
      reviewJobId: "job-1",
      checkId: "check-1",
      reviewResultId: "result-1",
    });

    expect(result.modelId).toBe("anthropic.claude-sonnet-4");
  });

  it("sets modelId to null when checkList modelId is not set", async () => {
    mockReviewJobRepo.findReviewJobById.mockResolvedValue(makeJobDetail());
    mockCheckRepo.findCheckListItemById.mockResolvedValue(
      makeCheckListItem({ modelId: undefined })
    );

    const result = await preReviewItemProcessor({
      reviewJobId: "job-1",
      checkId: "check-1",
      reviewResultId: "result-1",
    });

    expect(result.modelId).toBeNull();
  });

  it("sets modelId to null when checkList modelId is null", async () => {
    mockReviewJobRepo.findReviewJobById.mockResolvedValue(makeJobDetail());
    mockCheckRepo.findCheckListItemById.mockResolvedValue(
      makeCheckListItem({ modelId: null })
    );

    const result = await preReviewItemProcessor({
      reviewJobId: "job-1",
      checkId: "check-1",
      reviewResultId: "result-1",
    });

    expect(result.modelId).toBeNull();
  });

  it("returns correct payload shape with all expected fields", async () => {
    mockReviewJobRepo.findReviewJobById.mockResolvedValue(makeJobDetail());
    mockCheckRepo.findCheckListItemById.mockResolvedValue(
      makeCheckListItem({ modelId: "anthropic.claude-sonnet-4" })
    );

    const result = await preReviewItemProcessor({
      reviewJobId: "job-1",
      checkId: "check-1",
      reviewResultId: "result-1",
    });

    expect(result).toEqual({
      checkName: "Check Item",
      checkDescription: "Check description",
      feedbackSummary: null,
      languageName: "English",
      documentPaths: ["s3://bucket/test.pdf"],
      documentIds: ["doc-1"],
      toolConfiguration: null,
      modelId: "anthropic.claude-sonnet-4",
    });
  });

  it("throws when checkList item is not found", async () => {
    mockReviewJobRepo.findReviewJobById.mockResolvedValue(makeJobDetail());
    mockCheckRepo.findCheckListItemById.mockResolvedValue(null);

    await expect(
      preReviewItemProcessor({
        reviewJobId: "job-1",
        checkId: "missing-check",
        reviewResultId: "result-1",
      })
    ).rejects.toThrow("Check list item not found: missing-check");
  });

  it("throws when no documents found", async () => {
    mockReviewJobRepo.findReviewJobById.mockResolvedValue(
      makeJobDetail({ documents: [] })
    );
    mockCheckRepo.findCheckListItemById.mockResolvedValue(makeCheckListItem());

    await expect(
      preReviewItemProcessor({
        reviewJobId: "job-1",
        checkId: "check-1",
        reviewResultId: "result-1",
      })
    ).rejects.toThrow("No documents found for review job job-1");
  });

  it("includes toolConfiguration when checkList has toolConfigurationId", async () => {
    mockReviewJobRepo.findReviewJobById.mockResolvedValue(makeJobDetail());
    mockCheckRepo.findCheckListItemById.mockResolvedValue(
      makeCheckListItem({ toolConfigurationId: "tool-1", modelId: "model-x" })
    );
    mockToolConfigRepo.findById.mockResolvedValue({
      id: "tool-1",
      name: "KB Config",
      knowledgeBase: { knowledgeBaseId: "kb-1" },
      codeInterpreter: false,
      mcpConfig: null,
    });

    const result = await preReviewItemProcessor({
      reviewJobId: "job-1",
      checkId: "check-1",
      reviewResultId: "result-1",
    });

    expect(result.toolConfiguration).toEqual({
      knowledgeBase: { knowledgeBaseId: "kb-1" },
      codeInterpreter: false,
      mcpConfig: null,
    });
    expect(result.modelId).toBe("model-x");
  });

  it("uses user language preference when userId is provided", async () => {
    mockReviewJobRepo.findReviewJobById.mockResolvedValue(makeJobDetail());
    mockCheckRepo.findCheckListItemById.mockResolvedValue(makeCheckListItem());
    mockUserPrefRepo.getUserPreference.mockResolvedValue({
      language: "ja",
    });

    const result = await preReviewItemProcessor({
      reviewJobId: "job-1",
      checkId: "check-1",
      reviewResultId: "result-1",
      userId: "user-1",
    });

    expect(result.languageName).toBe("Japanese");
    expect(result.modelId).toBeNull();
  });

  it("falls back modelId to null when modelId is not in availableModels", async () => {
    mockReviewJobRepo.findReviewJobById.mockResolvedValue(makeJobDetail());
    mockCheckRepo.findCheckListItemById.mockResolvedValue(
      makeCheckListItem({ modelId: "removed-model-id" })
    );

    const result = await preReviewItemProcessor({
      reviewJobId: "job-1",
      checkId: "check-1",
      reviewResultId: "result-1",
    });

    expect(result.modelId).toBeNull();
  });

  it("falls back modelId to null when AVAILABLE_MODELS is empty", async () => {
    vi.stubEnv("AVAILABLE_MODELS", "[]");
    mockReviewJobRepo.findReviewJobById.mockResolvedValue(makeJobDetail());
    mockCheckRepo.findCheckListItemById.mockResolvedValue(
      makeCheckListItem({ modelId: "anthropic.claude-sonnet-4" })
    );

    const result = await preReviewItemProcessor({
      reviewJobId: "job-1",
      checkId: "check-1",
      reviewResultId: "result-1",
    });

    expect(result.modelId).toBeNull();
  });
});
