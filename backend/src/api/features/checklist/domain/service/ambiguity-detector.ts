import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { AmbiguityDetectionResult } from "../model/checklist";

const BEDROCK_REGION = process.env.BEDROCK_REGION || "us-west-2";
const MODEL_ID =
  process.env.DOCUMENT_PROCESSING_MODEL_ID ||
  "us.anthropic.claude-3-7-sonnet-20250219-v1:0";

const getAmbiguityDetectionPrompt = () => {
  return `あなたは審査基準の曖昧さを検知する専門家です。

以下の審査基準を分析し、曖昧な表現があれば具体的な修正案を提示してください。

## 曖昧な表現の例
- 「適切な」→ 具体的な基準や数値を示す
- 「十分な」→ 最小限の要件を明記する  
- 「必要に応じて」→ 具体的な条件を列挙する
- 「安く」→ 具体的な金額や割引率を示す
- 「資格者」→ 具体的な資格名や条件を明記する

## 出力形式
曖昧な表現がある場合は修正案を箇条書きで出力してください。
曖昧な表現がない場合は「曖昧な表現はありません」と出力してください。

## 例
入力: 「資格者の場合、安く登録できる」
出力:
• 「資格者」を「建築士資格保有者（一級・二級建築士）」に具体化
• 「安く」を「通常料金の20%割引（5,000円→4,000円）」に具体化

審査基準を分析してください。`;
};

export const detectAmbiguity = async (params: {
  description: string;
  userId?: string;
}): Promise<AmbiguityDetectionResult | null> => {
  const { description } = params;

  if (!description.trim()) {
    return null;
  }

  const bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });

  const prompt = `${getAmbiguityDetectionPrompt()}

審査基準: ${description}`;

  const response = await bedrockClient.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      messages: [{ role: "user", content: [{ text: prompt }] }],
    })
  );

  const llmResponse = response.output?.message?.content?.[0]?.text || "";

  if (llmResponse.includes("曖昧な表現はありません")) {
    return null;
  }

  // 箇条書きを配列に変換
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
