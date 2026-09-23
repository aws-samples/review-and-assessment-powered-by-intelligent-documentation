import { describe, it, expect, vi } from "vitest";
import {
  createChecklistItem,
  updateCheckListItemImportance,
} from "./checklist-item";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../core/errors/application-errors";

const owner = { userId: "owner-1", isAdmin: false };

const makeRepo = (overrides: Record<string, unknown> = {}) => ({
  findCheckListSetDetailById: vi.fn().mockResolvedValue({ userId: "owner-1" }),
  checkSetEditable: vi.fn().mockResolvedValue(true),
  validateParentItem: vi.fn().mockResolvedValue(true),
  storeCheckListItem: vi.fn().mockResolvedValue(undefined),
  findCheckListItemById: vi.fn().mockResolvedValue({
    id: "item-1",
    setId: "set-1",
    name: "Item",
    importance: "medium",
  }),
  updateCheckListItemImportance: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const storedItem = (repo: ReturnType<typeof makeRepo>) =>
  repo.storeCheckListItem.mock.calls[0][0].item;

describe("createChecklistItem importance", () => {
  it("stores medium when importance is omitted", async () => {
    const repo = makeRepo();

    await createChecklistItem({
      req: { Params: { setId: "set-1" }, Body: { name: "Item" } },
      user: owner,
      deps: { repo: repo as any },
    });

    expect(storedItem(repo).importance).toBe("medium");
  });

  it("stores the importance given in the request", async () => {
    const repo = makeRepo();

    await createChecklistItem({
      req: {
        Params: { setId: "set-1" },
        Body: { name: "Item", importance: "high" },
      },
      user: owner,
      deps: { repo: repo as any },
    });

    expect(storedItem(repo).importance).toBe("high");
  });

  it("rejects an unknown importance and stores nothing", async () => {
    const repo = makeRepo();

    await expect(
      createChecklistItem({
        req: {
          Params: { setId: "set-1" },
          Body: { name: "Item", importance: "urgent" },
        },
        user: owner,
        deps: { repo: repo as any },
      })
    ).rejects.toBeInstanceOf(ValidationError);

    expect(repo.storeCheckListItem).not.toHaveBeenCalled();
  });
});

describe("updateCheckListItemImportance", () => {
  const update = (
    repo: ReturnType<typeof makeRepo>,
    overrides: Record<string, unknown> = {}
  ) =>
    updateCheckListItemImportance({
      setId: "set-1",
      itemId: "item-1",
      importance: "high",
      user: owner,
      deps: { repo: repo as any },
      ...overrides,
    });

  it("updates the importance for the owner", async () => {
    const repo = makeRepo();

    await update(repo);

    expect(repo.updateCheckListItemImportance).toHaveBeenCalledWith({
      itemId: "item-1",
      importance: "high",
    });
  });

  it("updates the importance even when the set has review jobs", async () => {
    const repo = makeRepo({
      checkSetEditable: vi.fn().mockResolvedValue(false),
    });

    await update(repo);

    expect(repo.updateCheckListItemImportance).toHaveBeenCalled();
  });

  it("rejects an unknown importance", async () => {
    const repo = makeRepo();

    await expect(update(repo, { importance: "urgent" })).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(repo.updateCheckListItemImportance).not.toHaveBeenCalled();
  });

  it("rejects an item that belongs to another set", async () => {
    const repo = makeRepo({
      findCheckListItemById: vi.fn().mockResolvedValue({
        id: "item-1",
        setId: "set-2",
        name: "Item",
        importance: "medium",
      }),
    });

    await expect(update(repo)).rejects.toBeInstanceOf(ValidationError);
    expect(repo.updateCheckListItemImportance).not.toHaveBeenCalled();
  });

  it("throws ForbiddenError when a non-owner updates the importance", async () => {
    const repo = makeRepo();

    await expect(
      update(repo, { user: { userId: "other-1", isAdmin: false } })
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(repo.updateCheckListItemImportance).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when the item does not exist", async () => {
    const repo = makeRepo({
      findCheckListItemById: vi
        .fn()
        .mockRejectedValue(new NotFoundError("Item not found", "item-1")),
    });

    await expect(update(repo)).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.updateCheckListItemImportance).not.toHaveBeenCalled();
  });
});
