import { detectChecklistAmbiguity } from "../../api/features/checklist/usecase/ambiguity-detection";

export const detectAmbiguity = async (params: {
  checkListSetId: string;
  userId?: string;
}): Promise<{ status: string; checkListSetId: string }> => {
  await detectChecklistAmbiguity({
    checkListSetId: params.checkListSetId,
    userId: params.userId,
    concurrency: parseInt(process.env.CHECKLIST_INLINE_MAP_CONCURRENCY || "1"),
  });

  return {
    status: "completed",
    checkListSetId: params.checkListSetId,
  };
};
