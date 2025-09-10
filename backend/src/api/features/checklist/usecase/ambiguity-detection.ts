import { detectAmbiguity } from "../domain/service/ambiguity-detector";
import {
  CheckRepository,
  makePrismaCheckRepository,
} from "../domain/repository";

export const detectChecklistAmbiguity = async (params: {
  checkListSetId: string;
  userId?: string;
  concurrency?: number;
  deps?: { repo?: CheckRepository };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());
  const concurrency = params.concurrency || 1;

  const items = await repo.findCheckListItems(
    params.checkListSetId,
    undefined,
    true
  );

  const itemsWithDescription = items.filter((item) => item.description);

  // Process items in batches with controlled concurrency
  for (let i = 0; i < itemsWithDescription.length; i += concurrency) {
    const batch = itemsWithDescription.slice(i, i + concurrency);

    await Promise.all(
      batch.map(async (item) => {
        const result = await detectAmbiguity({
          description: item.description!,
          userId: params.userId,
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
