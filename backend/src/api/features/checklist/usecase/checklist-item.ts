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

export const createChecklistItem = async (params: {
  req: CreateChecklistItemRequest;
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());

  const { req } = params;
  const { setId } = req.Params;
  const { parentId } = req.Body;

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
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<CheckListItemEntity> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());

  const { itemId } = params;
  const checkListItem = await repo.findCheckListItemById(itemId);

  return checkListItem;
};

export const modifyCheckListItem = async (params: {
  req: UpdateChecklistItemRequest;
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());

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
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());

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

export const assignToolConfiguration = async (params: {
  checkId: string;
  toolConfigurationId: string | null;
  deps?: { repo?: CheckRepository };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());
  await repo.updateToolConfiguration({
    checkId: params.checkId,
    toolConfigurationId: params.toolConfigurationId,
  });
};
