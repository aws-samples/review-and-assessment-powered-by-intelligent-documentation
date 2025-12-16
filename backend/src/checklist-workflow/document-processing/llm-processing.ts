/**
 * Checklist extraction processing using LLM
 */
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { makePrismaUserPreferenceRepository } from "../../api/features/user-preference/domain/repository";
import {
  getChecklistPageKey,
  getChecklistLlmOcrTextKey,
} from "../common/storage-paths";
import { ParsedChecklistItem, ProcessWithLLMResult } from "../common/types";
import { getLanguageName, DEFAULT_LANGUAGE } from "../../utils/language";
import { ulid } from "ulid";

// Define model ID with environment variable override
const DEFAULT_MODEL_ID = "global.anthropic.claude-sonnet-4-20250514-v1:0"; // Sonnet 4
const MODEL_ID = process.env.DOCUMENT_PROCESSING_MODEL_ID || DEFAULT_MODEL_ID;

// Log model configuration
if (process.env.DOCUMENT_PROCESSING_MODEL_ID) {
  console.info(`Using custom document processing model: ${MODEL_ID}`);
} else {
  console.info(`Using default document processing model: ${MODEL_ID}`);
}

const BEDROCK_REGION = process.env.BEDROCK_REGION || "us-west-2";

// Helper function to get the checklist extraction prompt based on language
export const getChecklistExtractionPrompt = (language: string) => {
  const languageName = getLanguageName(language);

  return `
You are an AI assistant that extracts and structures "checklists" from technical documents, legal documents, tables, and diagrams.

## Overview
Extract checklist items from unstructured data and structure them including their hierarchical relationships.

## IMPORTANT OUTPUT LANGUAGE REQUIREMENT
YOU MUST GENERATE THE ENTIRE OUTPUT IN ${languageName}.
THIS IS A STRICT REQUIREMENT. ALL TEXT INCLUDING JSON FIELD VALUES MUST BE IN ${languageName}.

## Output Format
Output in strict JSON array format. Return only a pure JSON array.

Important: Always output in array format (enclosed in [ ]). Return an array, not an object ({ }).

Each checklist item should include the following fields:

- name: The name of the check item (IN ${languageName})
- description: Detailed explanation of the check content (IN ${languageName}) - ONLY for leaf nodes (items without children)
- parent_id: The number of the parent item (null for top-level items)

## CRITICAL DESCRIPTION RULE
- Generate descriptions ONLY for leaf nodes (items that do not have children)
- Parent nodes (items that have children) should have empty string "" for description
- Leaf nodes (items without children) should have detailed descriptions

## Extraction Rules
1. Identify simple check items and flowchart-type items
2. Express hierarchical structure through parent-child relationships (parent_id)
3. Extract all check items without omissions
4. Eliminate and organize duplicates
5. Express parent_id as a number (starting from 0, null for top-level items)
6. Generate descriptions ONLY for leaf nodes - parent nodes get empty descriptions

## Example Output Format (Array)
Example response (note: the example below is in English, but YOUR RESPONSE MUST BE IN ${languageName}):

[
  {
    "name": "Contract Information",
    "description": "",
    "parent_id": null
  },
  {
    "name": "Contract party description",
    "description": "Whether both parties' official names are accurately described in the contract",
    "parent_id": 0
  },
  {
    "name": "Contract date recording",
    "description": "Whether the contract conclusion date is clearly stated and matches the agreement date of both parties",
    "parent_id": 0
  }
]

## Notes
- Include all information that can be extracted from the document
- Accurately reflect the hierarchical structure
- Output only strict JSON arrays.
- ALWAYS OUTPUT IN ${languageName} including all field values
- Always express parent_id as a number (or null for top-level items)
- Always output in array format. Return an array, not an object.
- CRITICAL: Only leaf nodes (items without children) should have descriptions. Parent nodes get empty string descriptions.

REMEMBER: YOUR ENTIRE RESPONSE INCLUDING ALL JSON FIELD VALUES MUST BE IN ${languageName}.

Extract checklists from the input document in the format above and return as a JSON array.
`;
};

export interface ProcessWithLLMParams {
  documentId: string;
  pageNumber: number;
  userId?: string; // Optional user ID for language preference
}

/**
 * Extract checklists using LLM
 * @param params LLM processing parameters
 * @returns Processing result
 */
export async function processWithLLM({
  documentId,
  pageNumber,
  userId,
}: ProcessWithLLMParams): Promise<ProcessWithLLMResult> {
  const s3Client = new S3Client({});
  const bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });
  const bucketName = process.env.DOCUMENT_BUCKET || "";

  // Get user preference for language if userId is provided
  let userLanguage = DEFAULT_LANGUAGE;
  if (userId) {
    try {
      console.log(
        `[DEBUG] Attempting to get language preference for user ${userId}`
      );
      const userPreferenceRepository =
        await makePrismaUserPreferenceRepository();
      const userPreference =
        await userPreferenceRepository.getUserPreference(userId);
      console.log(
        `[DEBUG] User preference retrieved:`,
        JSON.stringify(userPreference, null, 2)
      );

      if (userPreference && userPreference.language) {
        userLanguage = userPreference.language;
        console.log(
          `[DEBUG] Setting user language from preference: ${userLanguage}`
        );
      } else {
        console.log(
          `[DEBUG] No language preference found in user data, using default: ${DEFAULT_LANGUAGE}`
        );
      }
    } catch (error) {
      console.error(`[DEBUG] Failed to fetch user language preference:`, error);
      // Continue with default language
    }
  } else {
    console.log(
      `[DEBUG] No userId provided, using default language: ${DEFAULT_LANGUAGE}`
    );
  }

  // Get PDF page
  const pageKey = getChecklistPageKey(documentId, pageNumber, "pdf");
  console.log(`Getting PDF page: ${pageKey}`);
  const { Body } = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: pageKey,
    })
  );

  if (!Body) {
    throw new Error(`Page not found: ${pageKey}`);
  }

  // Get PDF as byte array
  console.log(`Getting PDF as byte array: ${pageKey}`);
  const pdfBytes = await Body.transformToByteArray();
  console.log(`PDF byte array acquired: ${pdfBytes.length} bytes`);

  console.log(
    `Requesting checklist extraction from LLM: ${documentId}, page number: ${pageNumber}`
  );

  // Get the appropriate prompt based on user language
  console.log(
    `[DEBUG] Final language used for checklist extraction: ${userLanguage}`
  );
  console.log(`[DEBUG] Using model: ${MODEL_ID}`);
  console.log(`[DEBUG] PDF size: ${pdfBytes.length} bytes`);

  const checklistExtractionPrompt = getChecklistExtractionPrompt(userLanguage);

  // Determine citations setting based on model type
  const isNovaModel = MODEL_ID.includes("nova");
  const citationsConfig = isNovaModel
    ? { enabled: false } // Disable citations for Nova models as they cause InternalServerException
    : { enabled: true }; // Keep enabled for Other models for PDF image analysis workaround

  console.log(
    `[DEBUG] Citations enabled: ${citationsConfig.enabled} (Nova model: ${isNovaModel})`
  );

  let response: any;

  try {
    response = await bedrockClient.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        messages: [
          {
            role: "user",
            content: [
              { text: checklistExtractionPrompt },
              {
                document: {
                  name: "ChecklistDocument",
                  format: "pdf",
                  source: {
                    bytes: pdfBytes, // Actual PDF binary data
                  },
                  citations: citationsConfig,
                },
              },
            ],
          },
        ],
        // additionalModelRequestFields: {
        //   thinking: {
        //     type: "enabled",
        //     budget_tokens: 4000, // Maximum tokens for inference
        //   },
        // },
      })
    );

    console.log(`[DEBUG] Bedrock API call successful`);
    console.log(
      `[DEBUG] Response metadata:`,
      JSON.stringify(response.$metadata, null, 2)
    );
  } catch (error: any) {
    console.error(`[ERROR] Bedrock API call failed:`, error);
    console.error(`[ERROR] Model ID: ${MODEL_ID}`);
    console.error(`[ERROR] PDF size: ${pdfBytes.length} bytes`);
    console.error(`[ERROR] Citations enabled: ${citationsConfig.enabled}`);
    console.error(
      `[ERROR] Error type: ${error?.constructor?.name || "Unknown"}`
    );
    throw error;
  }

  // Extract text from response
  console.log(`Processing response from LLM...`);
  const outputMessage = response.output?.message;
  let llmResponse = "";
  if (outputMessage && outputMessage.content) {
    outputMessage.content.forEach((block: any) => {
      if ("text" in block) {
        llmResponse += block.text;
      }
    });
  }

  // JSONコードブロック（```json...```）をスペースなし正確に抽出する関数を修正
  function extractJsonBlocks(text: string): string {
    const regex = /```json([\s\S]*?)```/g; // jsonキーワード後のスペースを含めず厳密にマッチ
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    // 複数のJSONコードブロックがある場合は連結せず最初のものを返す例
    // 必要に応じて変更可能
    return matches.length > 0 ? matches[0] : text;
  }

  let checklistItems: ParsedChecklistItem[];
  try {
    // LLMの出力をJSONとしてパース
    try {
      checklistItems = JSON.parse(llmResponse);
    } catch (error) {
      // パースでエラーが発生している場合はJSONブロックを抽出してパースを試みる
      const jsonText = extractJsonBlocks(llmResponse);
      checklistItems = JSON.parse(jsonText);
    }
    console.log(
      `Parsed LLM response as JSON: ${JSON.stringify(checklistItems, null, 2)}`
    );

    // パース直後に各項目にIDを割り当て
    checklistItems = checklistItems.map((item) => ({
      ...item,
      id: ulid(),
    }));
  } catch (error) {
    console.error(
      `[ERROR] JSON parsing failed: ${error}\nLLM response: ${llmResponse}`
    );
    console.error(`[ERROR] Starting retry process for model: ${MODEL_ID}`);

    // If JSON parsing fails, send error message to Bedrock for retry
    const errorMessage = error instanceof Error ? error.message : String(error);

    try {
      const retryResponse = await bedrockClient.send(
        new ConverseCommand({
          modelId: MODEL_ID,
          messages: [
            {
              role: "user",
              content: [
                {
                  text: `${checklistExtractionPrompt}\n\nThe previous output could not be parsed as JSON. Error: ${errorMessage}\n\nPlease output in strict JSON array format.\n\nThis is page ${pageNumber} of the PDF file. Please extract the checklist.`,
                },
                {
                  document: {
                    name: "ChecklistDocument",
                    format: "pdf",
                    source: {
                      bytes: pdfBytes, // 実際のPDFバイナリデータ
                    },
                    citations: citationsConfig, // Use same citations config as initial request
                  },
                },
              ],
            },
          ],
          // additionalModelRequestFields: {
          //   thinking: {
          //     type: "enabled",
          //     budget_tokens: 4000, // 推論に使用する最大トークン数
          //   },
          // },
        })
      );

      console.log(`[DEBUG] Retry Bedrock API call successful`);

      // Extract text from retry response
      const retryOutputMessage = retryResponse.output?.message;
      let retryLlmResponse = "";
      if (retryOutputMessage && retryOutputMessage.content) {
        retryOutputMessage.content.forEach((block: any) => {
          if ("text" in block) {
            retryLlmResponse += block.text;
          }
        });
      }

      console.log(
        `[DEBUG] Retry response length: ${retryLlmResponse.length} characters`
      );

      try {
        checklistItems = JSON.parse(retryLlmResponse);
        console.log(`[DEBUG] Retry JSON parsing successful`);
      } catch (retryError) {
        console.error(`[ERROR] Retry JSON parsing also failed: ${retryError}`);
        console.error(`[ERROR] Retry LLM response: ${retryLlmResponse}`);
        throw new Error(
          `Both initial and retry JSON parsing failed. Original error: ${errorMessage}, Retry error: ${retryError}`
        );
      }
    } catch (retryApiError) {
      console.error(`[ERROR] Retry Bedrock API call failed: ${retryApiError}`);
      throw new Error(
        `Initial JSON parsing failed and retry API call also failed. Original error: ${errorMessage}, Retry API error: ${retryApiError}`
      );
    }

    // パース直後に各項目にIDを割り当て、数値型のIDを文字列に変換
    checklistItems = checklistItems.map((item) => {
      // 親IDを文字列に変換
      const parent_id =
        item.parent_id !== null && item.parent_id !== undefined
          ? String(item.parent_id)
          : null;

      return {
        ...item,
        id: ulid(),
        parent_id,
      };
    });
  }

  console.log(`Response from LLM: ${JSON.stringify(checklistItems, null, 2)}`);

  const updatedChecklist = convertToUlid(checklistItems);

  // 結果をS3に保存
  const resultKey = getChecklistLlmOcrTextKey(documentId, pageNumber);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: resultKey,
      Body: JSON.stringify(checklistItems),
      ContentType: "application/json",
    })
  );

  return {
    documentId,
    pageNumber,
  };
}

function convertToUlid(
  checklistItems: ParsedChecklistItem[]
): ParsedChecklistItem[] {
  // 型定義を追加
  const idMapping: { [key: string]: string } = {};

  // 各項目のIDをマッピング
  checklistItems.forEach((item) => {
    // IDはすでに割り当て済みなので、マッピングのみ行う
    idMapping[item.id] = item.id;

    if (item.parent_id !== null) {
      if (!idMapping[item.parent_id]) {
        idMapping[item.parent_id] = ulid();
      }
    }
  });

  // 各項目を変換
  const convertedItems = checklistItems.map((item) => {
    // 新しいアイテムを作成
    const newItem: ParsedChecklistItem = {
      ...item,
      // IDはすでに割り当て済み
    };

    // parent_idを変換（nullでない場合のみ）
    if (newItem.parent_id !== null) {
      newItem.parent_id = idMapping[newItem.parent_id];
    }

    return newItem;
  });

  return convertedItems;
}
