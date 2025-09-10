import { CreateChecklistSetRequest } from "../routes/handlers";
import {
  CheckRepository,
  makePrismaCheckRepository,
} from "../domain/repository";
import {
  CheckListSetDomain,
  CheckListItemDetail,
  CheckListSetSummary,
  CheckListSetDetailModel,
  CHECK_LIST_STATUS,
  AmbiguityFilter,
} from "../domain/model/checklist";
import { PaginatedResponse } from "../../../common/types";
import { ulid } from "ulid";
import { getPresignedUrl } from "../../../core/s3";
import { getChecklistOriginalKey } from "../../../../checklist-workflow/common/storage-paths";
import { ApplicationError } from "../../../core/errors";
import { startStateMachineExecution } from "../../../core/sfn";
import { sendMessage } from "../../../core/sqs";

export const createChecklistSet = async (params: {
  req: CreateChecklistSetRequest;
  userId?: string;
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());

  const { req } = params;
  const checkListSet = CheckListSetDomain.fromCreateRequest(req);
  await repo.storeCheckListSet({
    checkListSet,
  });

  const stateMachineArn = process.env.DOCUMENT_PROCESSING_STATE_MACHINE_ARN;
  if (!stateMachineArn) {
    throw new ApplicationError(
      "DOCUMENT_PROCESSING_STATE_MACHINE_ARN is not defined"
    );
  }

  // NOTE: Currently, only the first document is processed.
  if (req.documents.length === 0) {
    throw new ApplicationError("No documents found in the request");
  } else if (req.documents.length > 1) {
    throw new ApplicationError("Multiple documents are not supported");
  }
  const doc = req.documents[0];

  await startStateMachineExecution(stateMachineArn, {
    documentId: doc.documentId,
    fileName: doc.filename,
    checkListSetId: checkListSet.id,
    userId: params.userId,
  });
};

export const duplicateChecklistSet = async (params: {
  sourceCheckListSetId: string;
  newName?: string;
  newDescription?: string;
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());
  const { sourceCheckListSetId, newName, newDescription } = params;

  // 1. 元のチェックリストセットを取得
  const sourceCheckListSet =
    await repo.findCheckListSetDetailById(sourceCheckListSetId);

  // 2. 新しいチェックリストセットを作成
  const newCheckListSet = CheckListSetDomain.fromDuplicateRequest(
    sourceCheckListSetId,
    newName,
    newDescription,
    sourceCheckListSet
  );

  // 3. 新しいチェックリストセットを保存
  await repo.storeCheckListSet({
    checkListSet: newCheckListSet,
  });

  // 4. 元のチェックリストの項目を全て取得
  const sourceItems = await repo.findCheckListItems(
    sourceCheckListSetId,
    undefined,
    true // すべての子項目を含める
  );

  if (sourceItems.length === 0) {
    return; // 項目がなければ終了
  }

  // 5. IDマッピングを作成（古いID -> 新しいID）
  const idMapping = new Map<string, string>();
  sourceItems.forEach((item) => {
    idMapping.set(item.id, ulid());
  });

  // 6. 新しいチェックリスト項目を作成
  const newItems = sourceItems.map((item) => ({
    id: idMapping.get(item.id)!,
    setId: newCheckListSet.id,
    name: item.name,
    description: item.description || "",
    parentId: item.parentId ? idMapping.get(item.parentId) : undefined,
  }));

  // 7. 新しいチェックリスト項目を階層順に保存
  if (newItems.length > 0) {
    // 階層レベルごとにグループ化
    const itemsByLevel = new Map<number, (typeof newItems)[0][]>();

    // 最初に親IDがnullのアイテム（最上位）を設定
    const rootItems = newItems.filter((item) => !item.parentId);
    itemsByLevel.set(0, rootItems);

    // 処理済みの親IDを追跡
    let processedIds = new Set(rootItems.map((item) => item.id));

    // 残りのアイテム
    let remainingItems = newItems.filter((item) => item.parentId);
    let currentLevel = 0;

    // 残りのアイテムがなくなるか、処理できなくなるまで繰り返し
    while (remainingItems.length > 0) {
      currentLevel++;

      // 親IDが既に処理されたアイテムだけを選択
      const currentLevelItems = remainingItems.filter(
        (item) => item.parentId && processedIds.has(item.parentId)
      );

      // 処理できるアイテムがなくなったら中断
      if (currentLevelItems.length === 0) {
        console.error(`[Warning] Possible circular reference detected in checklist items.
          Unable to process ${remainingItems.length} items with parent references.`);
        break;
      }

      // このレベルのアイテムを設定
      itemsByLevel.set(currentLevel, currentLevelItems);

      // 処理済みIDを更新
      currentLevelItems.forEach((item) => processedIds.add(item.id));

      // 残りのアイテムを更新
      remainingItems = remainingItems.filter(
        (item) => !currentLevelItems.includes(item)
      );
    }

    // レベル順に保存
    for (let level = 0; level <= currentLevel; level++) {
      const levelItems = itemsByLevel.get(level) || [];
      if (levelItems.length > 0) {
        // このレベルのアイテムをバルク保存
        await repo.bulkStoreCheckListItems({ items: levelItems });
      }
    }
  }
};

export const removeChecklistSet = async (params: {
  checkListSetId: string;
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());

  const { checkListSetId } = params;
  await repo.deleteCheckListSetById({
    checkListSetId,
  });
};

export const getAllChecklistSets = async (params: {
  status?: CHECK_LIST_STATUS;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<PaginatedResponse<CheckListSetSummary>> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());

  const result = await repo.findAllCheckListSets({
    status: params.status,
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  });
  return result;
};

export const getCheckListDocumentPresignedUrl = async (params: {
  filename: string;
  contentType: string;
}): Promise<{ url: string; key: string; documentId: string }> => {
  const { filename, contentType } = params;
  const bucketName = process.env.DOCUMENT_BUCKET;
  if (!bucketName) {
    throw new Error("S3_BUCKET_NAME is not defined");
  }
  const documentId = ulid();
  const key = getChecklistOriginalKey(documentId, filename);
  const url = await getPresignedUrl(bucketName, key, contentType);

  return { url, key, documentId };
};

export const getChecklistItems = async (params: {
  checkListSetId: string;
  parentId?: string;
  includeAllChildren?: boolean;
  ambiguityFilter?: AmbiguityFilter;
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<CheckListItemDetail[]> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());

  const { checkListSetId, parentId, includeAllChildren, ambiguityFilter } =
    params;
  const checkListItems = await repo.findCheckListItems(
    checkListSetId,
    parentId,
    includeAllChildren,
    ambiguityFilter
  );
  return checkListItems;
};

export const getChecklistSetById = async (params: {
  checkListSetId: string;
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<CheckListSetDetailModel> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());
  const { checkListSetId } = params;
  const checkListSet = await repo.findCheckListSetDetailById(checkListSetId);
  return checkListSet;
};

export const startAmbiguityDetection = async (params: {
  checkListSetId: string;
  userId: string;
  deps?: {
    repo?: CheckRepository;
    sqsQueueUrl?: string;
  };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());
  const queueUrl = params.deps?.sqsQueueUrl || process.env.AMBIGUITY_DETECTION_QUEUE_URL!;

  // Update document status to detecting
  const checkListSet = await repo.findCheckListSetDetailById(params.checkListSetId);
  if (checkListSet.documents.length > 0) {
    await repo.updateDocumentStatus({
      documentId: checkListSet.documents[0].id,
      status: CHECK_LIST_STATUS.DETECTING,
    });
  }

  // Send message to SQS
  await sendMessage(queueUrl, {
    checkListSetId: params.checkListSetId,
    userId: params.userId,
  });
};
