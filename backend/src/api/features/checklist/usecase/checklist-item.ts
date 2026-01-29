import { ValidationError } from "../../../core/errors";
import {
  CheckListItemDomain,
  CheckListItemEntity,
} from "../domain/model/checklist";
import {
  CheckRepository,
  makePrismaCheckRepository,
} from "../domain/repository";
import {
  CreateChecklistItemRequest,
  UpdateChecklistItemRequest,
} from "../routes/handlers";
import {
  assertHasOwnerAccessOrThrow,
  RequestUser,
} from "../../../core/middleware/authorization";

const assertChecklistSetOwner = async (params: {
  user: RequestUser;
  setId: string;
  repo: CheckRepository;
  api: string;
  resourceId?: string;
}): Promise<void> => {
  const checkListSet = await params.repo.findCheckListSetDetailById(
    params.setId
  );
  const ownerUserId = checkListSet.userId;
  assertHasOwnerAccessOrThrow(params.user, ownerUserId, {
    api: params.api,
    resourceId: params.resourceId ?? params.setId,
    logger: console,
  });
};

export const createChecklistItem = async (params: {
  req: CreateChecklistItemRequest;
  user: RequestUser;
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());

  const { req } = params;
  const { setId } = req.Params;
  const { parentId } = req.Body;

  await assertChecklistSetOwner({
    user: params.user,
    setId,
    repo,
    api: "createChecklistItem",
  });

  const isEditable = await repo.checkSetEditable({
    setId: params.req.Params.setId,
  });
  if (!isEditable) {
    throw new ValidationError("Set is not editable");
  }

  if (parentId != null) {
    const isValid = repo.validateParentItem({
      parentItemId: parentId,
      setId,
    });
    if (!isValid) {
      throw new ValidationError("Invalid parent item");
    }
  }

  const item = CheckListItemDomain.fromCreateRequest(req);
  await repo.storeCheckListItem({
    item,
  });
};

export const getCheckListItem = async (params: {
  itemId: string;
  user: RequestUser;
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<CheckListItemEntity> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());

  const { itemId } = params;
  const checkListItem = await repo.findCheckListItemById(itemId);

  await assertChecklistSetOwner({
    user: params.user,
    setId: checkListItem.setId,
    repo,
    api: "getCheckListItem",
    resourceId: itemId,
  });

  return checkListItem;
};

export const modifyCheckListItem = async (params: {
  req: UpdateChecklistItemRequest;
  user: RequestUser;
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());

  await assertChecklistSetOwner({
    user: params.user,
    setId: params.req.Params.setId,
    repo,
    api: "modifyCheckListItem",
    resourceId: params.req.Params.itemId,
  });

  const isEditable = await repo.checkSetEditable({
    setId: params.req.Params.setId,
  });
  if (!isEditable) {
    throw new ValidationError("Set is not editable");
  }
  const currentItem = await repo.findCheckListItemById(
    params.req.Params.itemId
  );
  const newItem = CheckListItemDomain.createUpdatedItem(currentItem, {
    name: params.req.Body.name,
    description: params.req.Body.description,
    resolveAmbiguity: params.req.Body.resolveAmbiguity,
  });
  if (currentItem.setId !== newItem.setId) {
    throw new ValidationError("Invalid setId");
  }

  await repo.updateCheckListItem({
    newItem,
  });
  return;
};

export const removeCheckListItem = async (params: {
  setId: string;
  itemId: string;
  user: RequestUser;
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());

  await assertChecklistSetOwner({
    user: params.user,
    setId: params.setId,
    repo,
    api: "removeCheckListItem",
    resourceId: params.itemId,
  });

  const isEditable = await repo.checkSetEditable({
    setId: params.setId,
  });
  if (!isEditable) {
    throw new ValidationError("Set is not editable");
  }
  const { itemId } = params;

  await repo.deleteCheckListItemById({
    itemId,
  });
};

export const bulkAssignToolConfiguration = async (params: {
  checkIds: string[];
  toolConfigurationId: string | null;
  user: RequestUser;
  deps?: { repo?: CheckRepository };
}): Promise<number> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());
  if (params.checkIds.length === 0) {
    return 0;
  }

  const setIds = new Set<string>();
  for (const checkId of params.checkIds) {
    const item = await repo.findCheckListItemById(checkId);
    setIds.add(item.setId);
  }
  if (setIds.size > 1) {
    throw new ValidationError("Mixed checklist set ids are not supported");
  }
  const [setId] = Array.from(setIds);
  await assertChecklistSetOwner({
    user: params.user,
    setId,
    repo,
    api: "bulkAssignToolConfiguration",
  });
  const updatedCount = await repo.bulkUpdateToolConfiguration({
    checkIds: params.checkIds,
    toolConfigurationId: params.toolConfigurationId,
  });
  return updatedCount;
};
