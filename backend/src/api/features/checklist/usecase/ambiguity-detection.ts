import { detectAmbiguity } from "../domain/service/ambiguity-detector";
import {
  CheckRepository,
  makePrismaCheckRepository,
} from "../domain/repository";

export const detectChecklistAmbiguity = async (params: {
  checkListSetId: string;
  userId?: string;
  deps?: { repo?: CheckRepository };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());

  const items = await repo.findCheckListItems(
    params.checkListSetId,
    undefined,
    true
  );

  for (const item of items) {
    if (!item.description) continue;

    const result = await detectAmbiguity({
      description: item.description,
      userId: params.userId,
    });

    if (result) {
      await repo.updateAmbiguityReview({
        itemId: item.id,
        ambiguityReview: result,
      });
    }
  }
};
