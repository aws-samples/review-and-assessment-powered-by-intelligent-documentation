import { describe, it, expect, vi } from "vitest";
import {
  createChecklistItem,
  modifyCheckListItem,
  removeCheckListItem,
} from "./checklist-item";
import type { CreateChecklistItemRequest } from "../routes/handlers";
import { ForbiddenError } from "../../../core/errors/application-errors";

const makeRequest = (): CreateChecklistItemRequest => ({
  Params: { setId: "set-1" },
  Body: { name: "Item", description: "Desc" },
});

describe("createChecklistItem authorization", () => {
  it("throws ForbiddenError when user is not owner", async () => {
    const repo = {
      findCheckListSetDetailById: vi.fn().mockResolvedValue({
        userId: "owner-1",
      }),
      checkSetEditable: vi.fn().mockResolvedValue(true),
      validateParentItem: vi.fn().mockResolvedValue(true),
      storeCheckListItem: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      createChecklistItem({
        req: makeRequest(),
        user: { userId: "other-1", isAdmin: false },
        deps: { repo },
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows owner to create checklist item", async () => {
    const repo = {
      findCheckListSetDetailById: vi.fn().mockResolvedValue({
        userId: "owner-1",
      }),
      checkSetEditable: vi.fn().mockResolvedValue(true),
      validateParentItem: vi.fn().mockResolvedValue(true),
      storeCheckListItem: vi.fn().mockResolvedValue(undefined),
    };

    await createChecklistItem({
      req: makeRequest(),
      user: { userId: "owner-1", isAdmin: false },
      deps: { repo },
    });

    expect(repo.storeCheckListItem).toHaveBeenCalled();
  });
});

describe("checklist item edit/delete authorization", () => {
  it("throws ForbiddenError when non-owner modifies item", async () => {
    const repo = {
      findCheckListSetDetailById: vi.fn().mockResolvedValue({
        userId: "owner-1",
      }),
      checkSetEditable: vi.fn().mockResolvedValue(true),
      findCheckListItemById: vi.fn().mockResolvedValue({
        id: "item-1",
        setId: "set-1",
        name: "Item",
        description: "Desc",
      }),
      updateCheckListItem: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      modifyCheckListItem({
        req: {
          Params: { setId: "set-1", itemId: "item-1" },
          Body: {
            name: "Updated",
            description: "Updated",
            resolveAmbiguity: false,
          },
        },
        user: { userId: "other-1", isAdmin: false },
        deps: { repo },
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws ForbiddenError when non-owner deletes item", async () => {
    const repo = {
      findCheckListSetDetailById: vi.fn().mockResolvedValue({
        userId: "owner-1",
      }),
      checkSetEditable: vi.fn().mockResolvedValue(true),
      deleteCheckListItemById: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      removeCheckListItem({
        setId: "set-1",
        itemId: "item-1",
        user: { userId: "other-1", isAdmin: false },
        deps: { repo },
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
