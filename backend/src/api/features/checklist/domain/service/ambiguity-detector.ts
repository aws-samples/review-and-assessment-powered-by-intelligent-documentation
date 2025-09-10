import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  AmbiguityDetectionResult,
  CheckListItemEntity,
} from "../model/checklist";
import { makePrismaUserPreferenceRepository } from "../../../user-preference/domain/repository";

const BEDROCK_REGION = process.env.BEDROCK_REGION || "us-west-2";
const MODEL_ID =
  process.env.DOCUMENT_PROCESSING_MODEL_ID ||
  "us.anthropic.claude-3-7-sonnet-20250219-v1:0";

const getAmbiguityDetectionPrompt = (
  languageName: string,
  checklistContext: CheckListItemEntity[]
) => {
  const contextSection =
    checklistContext.length > 1
      ? `## CHECKLIST CONTEXT
The following items are part of the same checklist for comprehensive analysis:
${checklistContext
  .map(
    (item, index) =>
      `${index + 1}. ${item.name}: ${item.description || "No description"}`
  )
  .join("\n")}

Consider the relationships and consistency between items when analyzing ambiguity.
`
      : "";

  return `You are an expert at detecting ambiguous expressions in review criteria.

${contextSection}

Analyze the review criteria and provide specific improvement suggestions if ambiguous expressions are found.

## Examples of Ambiguous Expressions
- "appropriate" → specify concrete standards or numerical values
- "sufficient" → clarify minimum requirements
- "as needed" → enumerate specific conditions
- "cheap" → specify concrete amounts or discount rates
- "qualified person" → specify exact qualifications or conditions

## Output Format
If ambiguous expressions are found, output improvement suggestions as bullet points.
If no ambiguous expressions are found, output "No ambiguous expressions found".

## Example
Input: "Qualified persons can register at a discount"
Output:
• Specify "qualified person" as "Licensed architects (first-class or second-class architects)"
• Specify "discount" as "20% off regular price (5,000 yen → 4,000 yen)"

ALL OUTPUT MUST BE IN ${languageName}.

Please analyze the review criteria.`;
};

export const detectAmbiguity = async (params: {
  description: string;
  userId: string;
  checklistContext: CheckListItemEntity[];
}): Promise<AmbiguityDetectionResult | null> => {
  const { description, userId, checklistContext } = params;

  if (!description.trim()) {
    return null;
  }

  // Fetch user language preference
  const userPreferenceRepository = await makePrismaUserPreferenceRepository();
  const userPreference =
    await userPreferenceRepository.getUserPreference(userId);
  const userLanguage = userPreference?.language || "en";

  // Map language codes to display names
  const languageMap: Record<string, string> = {
    en: "English",
    ja: "Japanese",
  };
  const languageName = languageMap[userLanguage] || "English";

  const bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });

  const prompt = `${getAmbiguityDetectionPrompt(languageName, checklistContext)}

Review criteria: ${description}`;

  const response = await bedrockClient.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      messages: [{ role: "user", content: [{ text: prompt }] }],
    })
  );

  const llmResponse = response.output?.message?.content?.[0]?.text || "";

  // Check for "no ambiguous expressions" in multiple languages
  const noAmbiguityPhrases = [
    "No ambiguous expressions found",
    "曖昧な表現はありません",
    "ambiguous expressions found", // partial match for variations
  ];

  if (noAmbiguityPhrases.some((phrase) => llmResponse.includes(phrase))) {
    return null;
  }

  // Extract bullet points
  const suggestions = llmResponse
    .split("\n")
    .filter(
      (line) => line.trim().startsWith("•") || line.trim().startsWith("-")
    )
    .map((line) => line.replace(/^[•\-]\s*/, "").trim())
    .filter((line) => line.length > 0);

  if (suggestions.length === 0) {
    return null;
  }

  return {
    suggestions,
    detectedAt: new Date(),
  };
};
