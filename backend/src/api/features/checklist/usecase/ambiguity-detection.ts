import { detectAmbiguity } from "../domain/service/ambiguity-detector";
import {
  CheckRepository,
  makePrismaCheckRepository,
} from "../domain/repository";

export const detectChecklistAmbiguity = async (params: {
  checkListSetId: string;
  userId: string;
  concurrency?: number;
  deps?: { repo?: CheckRepository };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());
  const concurrency = params.concurrency || 1;

  // Get all items for context
  const allItems = await repo.findCheckListItems(
    params.checkListSetId,
    undefined,
    true
  );

  // Filter items with description
  const itemsWithDescription = allItems.filter((item) => item.description);

  // Filter to leaf nodes only (items that are not parents of other items)
  const leafItems = itemsWithDescription.filter((item) => !item.hasChildren);

  // Process leaf items in batches with controlled concurrency
  for (let i = 0; i < leafItems.length; i += concurrency) {
    const batch = leafItems.slice(i, i + concurrency);

    await Promise.all(
      batch.map(async (item) => {
        const result = await detectAmbiguity({
          description: item.description!,
          userId: params.userId,
          checklistContext: allItems,
        });

        if (result) {
          await repo.updateAmbiguityReview({
            itemId: item.id,
            ambiguityReview: result,
          });
        }
      })
    );
  }
};
