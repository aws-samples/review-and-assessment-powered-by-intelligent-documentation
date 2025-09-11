import { PrismaClient, getPrismaClient } from "../../../core/db";
import { NotFoundError } from "../../../core/errors";
import {
  CheckListItemEntity,
  CheckListItemDetail,
  CheckListSetSummary,
  CheckListSetEntity,
  CHECK_LIST_STATUS,
  CheckListSetDetailModel,
  CheckListItemDomain,
  AmbiguityDetectionResult,
  AmbiguityFilter,
} from "./model/checklist";
import { PaginatedResponse } from "../../../common/types";

export interface CheckRepository {
  storeCheckListSet(params: {
    checkListSet: CheckListSetEntity;
  }): Promise<void>;
  deleteCheckListSetById(params: { checkListSetId: string }): Promise<void>;
  findAllCheckListSets(params: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    status?: CHECK_LIST_STATUS;
  }): Promise<PaginatedResponse<CheckListSetSummary>>;
  findCheckListItems(
    setId: string,
    parentId?: string,
    includeAllChildren?: boolean,
    ambiguityFilter?: AmbiguityFilter
  ): Promise<CheckListItemDetail[]>;
  findCheckListSetDetailById(setId: string): Promise<CheckListSetDetailModel>;
  storeCheckListItem(params: { item: CheckListItemEntity }): Promise<void>;
  bulkStoreCheckListItems(params: {
    items: CheckListItemEntity[];
  }): Promise<void>;
  updateDocumentStatus(params: {
    documentId: string;
    status: CHECK_LIST_STATUS;
    errorDetail?: string;
  }): Promise<void>;
  findCheckListItemById(itemId: string): Promise<CheckListItemEntity>;
  validateParentItem(params: {
    parentItemId: string;
    setId: string;
  }): Promise<boolean>;
  updateCheckListItem(params: { newItem: CheckListItemEntity }): Promise<void>;
  deleteCheckListItemById(params: { itemId: string }): Promise<void>;
  checkSetEditable(params: { setId: string }): Promise<boolean>;
  updateAmbiguityReview(params: {
    itemId: string;
    ambiguityReview: AmbiguityDetectionResult;
  }): Promise<void>;
}

export const makePrismaCheckRepository = async (
  clientInput: PrismaClient | null = null
): Promise<CheckRepository> => {
  const client = clientInput || (await getPrismaClient());

  const storeCheckListSet = async (params: {
    checkListSet: CheckListSetEntity;
  }): Promise<void> => {
    const { checkListSet } = params;
    const { id, name, description, documents, createdAt } = checkListSet;

    await client.checkListSet.create({
      data: {
        id,
        name,
        description,
        createdAt: createdAt,
        documents: {
          create: documents.map((doc) => ({
            id: doc.id,
            filename: doc.filename,
            s3Path: doc.s3Key,
            fileType: doc.fileType,
            uploadDate: doc.uploadDate,
            status: doc.status,
          })),
        },
      },
    });
  };

  const deleteCheckListSetById = async (params: {
    checkListSetId: string;
  }): Promise<void> => {
    const { checkListSetId } = params;
    await client.$transaction(async (tx) => {
      // 1. まず ReviewResult を削除 (CheckList への外部キー参照があるため)
      await tx.reviewResult.deleteMany({
        where: {
          checkList: {
            checkListSetId: checkListSetId,
          },
        },
      });

      // 2. チェックリスト項目を階層的に削除：最下層から上へ
      // すべてのノードが削除されるまで繰り返す
      let deletedCount = 0;
      do {
        // リーフノード（子を持たないノード）を検索して削除
        const childParentIds = await tx.checkList.findMany({
          where: {
            checkListSetId: checkListSetId,
            parentId: { not: null },
          },
          select: { parentId: true },
        });

        const parentIdsToExclude = childParentIds
          .map((r) => r.parentId)
          .filter(Boolean) as string[];

        const result = await tx.checkList.deleteMany({
          where: {
            checkListSetId: checkListSetId,
            // このIDを親として参照している子が存在しないノードを検索
            id: {
              notIn: parentIdsToExclude,
            },
          },
        });

        deletedCount = result.count;
        console.log(
          `[Repository] Deleted ${deletedCount} leaf nodes from check list`
        );

        // もう削除するノードがなくなったら終了
        if (deletedCount === 0) break;
      } while (true);

      // 3. ReviewDocument を削除
      await tx.reviewDocument.deleteMany({
        where: {
          reviewJob: {
            checkListSetId: checkListSetId,
          },
        },
      });

      // 4. ReviewJob を削除
      await tx.reviewJob.deleteMany({
        where: {
          checkListSetId: checkListSetId,
        },
      });

      // 5. CheckListDocument を削除
      await tx.checkListDocument.deleteMany({
        where: { checkListSetId: checkListSetId },
      });

      // 6. 最後に CheckListSet 自体を削除
      await tx.checkListSet.delete({
        where: { id: checkListSetId },
      });

      console.log(
        `[Repository] Successfully deleted check list set: ${checkListSetId}`
      );
    });
  };

  const findAllCheckListSets = async (
    params: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      status?: CHECK_LIST_STATUS;
    } = {}
  ): Promise<PaginatedResponse<CheckListSetSummary>> => {
    const {
      page = 1,
      limit = 10,
      sortBy = "id",
      sortOrder = "desc",
      status,
    } = params;
    // ステータスフィルタリングのためのサブクエリを準備
    let whereCondition = {};

    console.log(
      `[Repository] findAllCheckListSets - requested status: ${status || "all"}`
    );

    // ステータスに基づいてフィルタリング条件を設定
    if (status) {
      switch (status) {
        case "completed":
          whereCondition = {
            documents: {
              some: {}, // ドキュメントが1つ以上存在するセットを取得
              every: { status: "completed" },
            },
          };
          console.log("[Repository] Using completed filter condition");
          break;
        case "processing":
          whereCondition = {
            documents: {
              some: { status: "processing" },
            },
          };
          console.log("[Repository] Using processing filter condition");
          break;
        case "pending":
          whereCondition = {
            documents: {
              none: { status: "processing" },
            },
          };
          console.log("[Repository] Using pending filter condition");
          break;
      }
    }

    // ページネーション用のクエリを並列実行
    const [sets, total] = await Promise.all([
      client.checkListSet.findMany({
        where: whereCondition,
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          // ドキュメントの詳細情報を取得
          documents: {
            select: {
              id: true,
              filename: true,
              s3Path: true,
              fileType: true,
              uploadDate: true,
              status: true,
              errorDetail: true,
            },
          },
          _count: { select: { reviewJobs: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      client.checkListSet.count({
        where: whereCondition,
      }),
    ]);

    const mappedSets = sets.map((s) => {
      const statuses = s.documents.map((d) => d.status as CHECK_LIST_STATUS);

      let processingStatus: CHECK_LIST_STATUS;
      if (statuses.length === 0) {
        processingStatus = CHECK_LIST_STATUS.PENDING;
      } else if (statuses.some((st) => st === CHECK_LIST_STATUS.PROCESSING)) {
        processingStatus = CHECK_LIST_STATUS.PROCESSING;
      } else if (statuses.some((st) => st === CHECK_LIST_STATUS.DETECTING)) {
        processingStatus = CHECK_LIST_STATUS.DETECTING;
      } else if (statuses.every((st) => st === CHECK_LIST_STATUS.COMPLETED)) {
        processingStatus = CHECK_LIST_STATUS.COMPLETED;
      } else if (statuses.some((st) => st === CHECK_LIST_STATUS.FAILED)) {
        processingStatus = CHECK_LIST_STATUS.FAILED;
      } else {
        processingStatus = CHECK_LIST_STATUS.PENDING;
      }

      return {
        id: s.id,
        name: s.name,
        description: s.description ?? "",
        processingStatus,
        isEditable: s._count.reviewJobs === 0,
        createdAt: s.createdAt,
        documents: s.documents.map((doc) => ({
          id: doc.id,
          filename: doc.filename,
          s3Key: doc.s3Path,
          fileType: doc.fileType,
          uploadDate: doc.uploadDate,
          status: doc.status as CHECK_LIST_STATUS,
          errorDetail: doc.errorDetail || undefined,
        })),
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      items: mappedSets,
      total,
      page,
      limit,
      totalPages,
    };
  };

  const findCheckListItems = async (
    setId: string,
    parentId?: string,
    includeAllChildren?: boolean,
    ambiguityFilter?: AmbiguityFilter
  ): Promise<CheckListItemDetail[]> => {
    console.log(
      `[Repository] findCheckListItems - setId: ${setId}, parentId: ${
        parentId || "null"
      }, includeAllChildren: ${includeAllChildren}, ambiguityFilter: ${ambiguityFilter || "none"}`
    );

    // クエリの基本条件を構築
    const whereCondition: any = {
      checkListSetId: setId,
    };

    // includeAllChildrenがfalseの場合のみ、parentIdの条件を適用
    if (!includeAllChildren) {
      whereCondition.parentId = parentId || null;
    }

    // ambiguityFilterの条件を追加
    if (ambiguityFilter === AmbiguityFilter.HAS_AMBIGUITY) {
      whereCondition.ambiguityReview = {
        not: null,
      };
    }

    console.log(
      `[Repository] Query condition:`,
      JSON.stringify(whereCondition, null, 2)
    );

    // チェックリスト項目を取得
    const items = await client.checkList.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        description: true,
        parentId: true,
        checkListSetId: true,
        documentId: true,
        ambiguityReview: true,
      },
      orderBy: { id: "asc" },
    });

    console.log(`[Repository] Found ${items.length} items`);

    if (items.length === 0) {
      return [];
    }

    // 子要素の有無を一括確認
    const itemIds = items.map((item) => item.id);

    console.log(`[Repository] Checking for children of itemIds:`, itemIds);

    // すべてのアイテムIDに対する子の存在を一度に確認する
    const childItems = await client.checkList.findMany({
      where: {
        checkListSetId: setId,
        parentId: {
          in: itemIds,
        },
      },
      select: {
        parentId: true,
      },
    });

    console.log(`[Repository] Found ${childItems.length} child items`);

    // 子を持つ親IDのセットを作成
    const parentsWithChildren = new Set(
      childItems.map((child) => child.parentId)
    );

    console.log(
      `[Repository] Parents with children:`,
      Array.from(parentsWithChildren)
    );

    // 結果を新しいモデル形式に変換して返す
    const mappedItems = items.map((item) => {
      const entity = CheckListItemDomain.fromPrismaCheckListItem(item);
      return {
        ...entity,
        hasChildren: parentsWithChildren.has(item.id),
      };
    });

    console.log(
      `[Repository] Final items with hasChildren:`,
      mappedItems.map((i) => ({
        id: i.id,
        hasChildren: i.hasChildren,
      }))
    );

    return mappedItems;
  };

  const findCheckListSetDetailById = async (
    setId: string
  ): Promise<CheckListSetDetailModel> => {
    const checkListSet = await client.checkListSet.findUnique({
      where: { id: setId },
      include: {
        documents: true,
      },
    });

    if (!checkListSet) {
      throw new NotFoundError("CheckListSet not found", setId);
    }

    // チェックリストセットが編集可能かどうかを確認
    const isEditable = await checkSetEditable({ setId });

    // ドキュメントのエラー情報を集約
    const failedDocuments = checkListSet.documents.filter(
      (doc) => doc.status === "failed" && doc.errorDetail
    );

    // エラーサマリーを作成
    let errorSummary: string | undefined;
    if (failedDocuments.length > 0) {
      if (failedDocuments.length === 1) {
        errorSummary = `ドキュメント「${failedDocuments[0].filename}」の処理中にエラーが発生しました: ${failedDocuments[0].errorDetail}`;
      } else {
        errorSummary = `${failedDocuments.length}件のドキュメント処理中にエラーが発生しました`;
      }
    }

    // Calculate processing status from documents
    const statuses = checkListSet.documents.map(
      (d) => d.status as CHECK_LIST_STATUS
    );
    let processingStatus: CHECK_LIST_STATUS;
    if (statuses.length === 0) {
      processingStatus = CHECK_LIST_STATUS.PENDING;
    } else if (statuses.some((st) => st === CHECK_LIST_STATUS.PROCESSING)) {
      processingStatus = CHECK_LIST_STATUS.PROCESSING;
    } else if (statuses.some((st) => st === CHECK_LIST_STATUS.DETECTING)) {
      processingStatus = CHECK_LIST_STATUS.DETECTING;
    } else if (statuses.every((st) => st === CHECK_LIST_STATUS.COMPLETED)) {
      processingStatus = CHECK_LIST_STATUS.COMPLETED;
    } else if (statuses.some((st) => st === CHECK_LIST_STATUS.FAILED)) {
      processingStatus = CHECK_LIST_STATUS.FAILED;
    } else {
      processingStatus = CHECK_LIST_STATUS.PENDING;
    }

    return {
      id: checkListSet.id,
      name: checkListSet.name,
      description: checkListSet.description ?? "",
      documents: checkListSet.documents.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        s3Key: doc.s3Path,
        fileType: doc.fileType,
        uploadDate: doc.uploadDate,
        status: doc.status as CHECK_LIST_STATUS,
        errorDetail: doc.errorDetail || undefined,
      })),
      processingStatus,
      isEditable,
      errorSummary,
      hasError: failedDocuments.length > 0,
    };
  };

  const storeCheckListItem = async (params: {
    item: CheckListItemEntity;
  }): Promise<void> => {
    const { item } = params;
    const { id, name, description, setId, parentId } = item;

    await client.checkList.create({
      data: {
        id,
        name,
        description,
        checkListSetId: setId,
        parentId: parentId,
      },
    });
  };

  const bulkStoreCheckListItems = async (params: {
    items: CheckListItemEntity[];
  }): Promise<void> => {
    const { items } = params;

    try {
      await client.checkList.createMany({
        data: items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          parentId: item.parentId,
          checkListSetId: item.setId,
        })),
      });
    } catch (error) {
      console.error("Error creating checklist items:", error);
      throw error;
    }
  };

  const updateDocumentStatus = async (params: {
    documentId: string;
    status: CHECK_LIST_STATUS;
    errorDetail?: string;
  }): Promise<void> => {
    const { documentId, status, errorDetail } = params;
    await client.checkListDocument.update({
      where: { id: documentId },
      data: {
        status,
        errorDetail,
      },
    });
  };

  const findCheckListItemById = async (
    itemId: string
  ): Promise<CheckListItemEntity> => {
    const item = await client.checkList.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        name: true,
        description: true,
        parentId: true,
        checkListSetId: true,
        documentId: true,
        ambiguityReview: true,
      },
    });

    if (!item) {
      throw new NotFoundError("Item not found", itemId);
    }

    return CheckListItemDomain.fromPrismaCheckListItem(item);
  };

  const validateParentItem = async (params: {
    parentItemId: string;
    setId: string;
  }): Promise<boolean> => {
    const parent = await client.checkList.findUnique({
      where: { id: params.parentItemId },
      select: {
        id: true,
        checkListSetId: true,
        documentId: true,
      },
    });
    if (!parent) {
      return false;
    }

    const belongsTo = parent.checkListSetId === params.setId;
    return belongsTo;
  };

  const updateCheckListItem = async (params: {
    newItem: CheckListItemEntity;
  }): Promise<void> => {
    const { newItem } = params;
    const prismaData = CheckListItemDomain.toPrismaCheckListItem(newItem);

    await client.checkList.update({
      where: { id: newItem.id },
      data: {
        name: prismaData.name,
        description: prismaData.description,
        ambiguityReview: prismaData.ambiguityReview as any,
      },
    });
  };

  const deleteCheckListItemById = async (params: {
    itemId: string;
  }): Promise<void> => {
    const { itemId } = params;

    // 子アイテムを再帰的に削除
    const childItems = await client.checkList.findMany({
      where: { parentId: itemId },
      select: { id: true },
    });

    for (const child of childItems) {
      await deleteCheckListItemById({ itemId: child.id });
    }

    // 自身を削除
    await client.checkList.delete({
      where: { id: itemId },
    });
  };

  const checkSetEditable = async (params: {
    setId: string;
  }): Promise<boolean> => {
    const { setId } = params;
    const count = await client.reviewJob.count({
      where: { checkListSetId: setId },
    });
    return count === 0;
  };

  const updateAmbiguityReview = async (params: {
    itemId: string;
    ambiguityReview: AmbiguityDetectionResult;
  }): Promise<void> => {
    const prismaData = CheckListItemDomain.toPrismaCheckListItem({
      id: params.itemId,
      ambiguityReview: params.ambiguityReview,
    } as CheckListItemEntity);

    await client.checkList.update({
      where: { id: params.itemId },
      data: {
        ambiguityReview: prismaData.ambiguityReview as any,
      },
    });
  };

  return {
    storeCheckListSet,
    deleteCheckListSetById,
    findAllCheckListSets,
    findCheckListItems,
    findCheckListSetDetailById,
    storeCheckListItem,
    bulkStoreCheckListItems,
    updateDocumentStatus,
    findCheckListItemById,
    validateParentItem,
    updateCheckListItem,
    deleteCheckListItemById,
    checkSetEditable,
    updateAmbiguityReview,
  };
};
