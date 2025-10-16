import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import {
  BedrockRuntimeClient,
  ConverseCommand,
  TokenUsage,
} from "@aws-sdk/client-bedrock-runtime";
import {
  makePrismaReviewJobRepository,
  makePrismaReviewResultRepository,
} from "../../api/features/review/domain/repository";
import { makePrismaUserPreferenceRepository } from "../../api/features/user-preference/domain/repository";
import {
  REVIEW_JOB_STATUS,
  ReviewResultDomain,
} from "../../api/features/review/domain/model/review";
import { makePrismaCheckRepository } from "../../api/features/checklist/domain/repository";
import { getLanguageName, DEFAULT_LANGUAGE } from "../../utils/language";

// Define model ID with environment variable override
const DEFAULT_MODEL_ID = "global.anthropic.claude-sonnet-4-20250514-v1:0"; // 現在の実装に合わせてSonnet 4をデフォルトに
const MODEL_ID = process.env.IMAGE_REVIEW_MODEL_ID || DEFAULT_MODEL_ID;

// Log model configuration
if (process.env.IMAGE_REVIEW_MODEL_ID) {
  console.info(`Using custom image review model: ${MODEL_ID}`);
} else {
  console.info(`Using default image review model: ${MODEL_ID}`);
}

const BEDROCK_REGION = process.env.BEDROCK_REGION || "us-west-2";

// Helper function to get the image review prompt based on language
const getImageReviewPrompt = (language: string) => {
  const languageName = getLanguageName(language);

  return `
You are an AI assistant who reviews documents.
Please review the provided image based on the following check items.

Check item: {checkName}
Description: {checkDescription}

## IMPORTANT OUTPUT LANGUAGE REQUIREMENT
YOU MUST GENERATE THE ENTIRE OUTPUT IN ${languageName}.
THIS IS A STRICT REQUIREMENT. ALL TEXT INCLUDING ALL JSON FIELD VALUES MUST BE IN ${languageName}.

Review the content of the image and determine whether it complies with this check item.
If multiple images are provided, each image can be referenced with a zero-based index (0th, 1st, etc.).

Also, if objects related to the check item exist in the image, please provide the coordinates of the bounding box for that object.
Coordinates should be specified in the format [x1, y1, x2, y2], with values ranging from 0 to 1000.

Here are examples of responses:

Example response (note: the examples below are in English, but YOUR RESPONSE MUST BE IN ${languageName}):

Example 1: For a check item "Multiple documents should have signatures" with 5 images provided
{
  "result": "pass",
  "confidence": 0.92,
  "explanation": "Out of the 5 provided images, signatures can be confirmed in the 0th and 2nd images. The 0th image has a contract signature, and the 2nd image has a consent form signature.",
  "shortExplanation": "Pass because contract and consent form signatures are confirmed in the 0th and 2nd images",
  "usedImageIndexes": [0, 2],
  "boundingBoxes": [
    {
      "imageIndex": 0,
      "label": "Contract signature",
      "coordinates": [750, 800, 950, 850]
    },
    {
      "imageIndex": 2,
      "label": "Consent form signature",
      "coordinates": [500, 700, 700, 750]
    }
  ]
}

Example 2: For a check item "ID card should include photo and expiration date" with 1 image provided
{
  "result": "pass",
  "confidence": 0.95,
  "explanation": "The ID card includes both a photo and an expiration date. Expiration date: May 31, 2028",
  "shortExplanation": "Pass because the ID card contains both a photo and expiration date (May 31, 2028)",
  "usedImageIndexes": [0],
  "boundingBoxes": [
    {
      "imageIndex": 0,
      "label": "Photo",
      "coordinates": [100, 150, 300, 350]
    },
    {
      "imageIndex": 0,
      "label": "Expiration date",
      "coordinates": [400, 500, 600, 530]
    }
  ]
}

It is strictly forbidden to output anything other than JSON. Do not use markdown syntax (like \`\`\`json), return only pure JSON.

The shortExplanation should be a concise summary of the judgment within 80 characters.
For example: "Pass because signatures and seals are confirmed on the contract" or "Fail because property area is not mentioned"

{
  "result": "pass" or "fail",
  "confidence": A number between 0 and 1 (confidence level),
  "explanation": "Explanation of the judgment (IN ${languageName})",
  "shortExplanation": "Short summary of judgment (within 80 characters) (IN ${languageName})",
  "usedImageIndexes": [Indexes of images used for judgment (e.g., [0, 2] means the first and third images were used)],
  "boundingBoxes": [
    {
      "imageIndex": Image index,
      "label": "Label of detected object (IN ${languageName})",
      "coordinates": [x1, y1, x2, y2]
    }
  ]
}

REMEMBER: YOUR ENTIRE RESPONSE INCLUDING ALL JSON FIELD VALUES MUST BE IN ${languageName}.
`;
};

/**
 * Image review item processing parameters
 */
interface ProcessImageReviewItemParams {
  reviewJobId: string;
  documents: Array<{
    id: string;
    filename: string;
    s3Path: string;
    fileType: string;
  }>;
  checkId: string;
  reviewResultId: string;
  userId?: string; // Optional user ID for language preference
}

/**
 * Process an image review item
 * @param params Processing parameters
 * @returns Processing result
 */
export async function processImageReviewItem(
  params: ProcessImageReviewItemParams
): Promise<any> {
  const { reviewJobId, documents, checkId, reviewResultId, userId } = params;
  const reviewResultRepository = await makePrismaReviewResultRepository();
  const checkRepository = await makePrismaCheckRepository();

  // Get user preference for language if userId is provided
  let userLanguage = DEFAULT_LANGUAGE;
  if (userId) {
    try {
      console.log(
        `[DEBUG IMAGE] Attempting to get language preference for user ${userId}`
      );
      const userPreferenceRepository =
        await makePrismaUserPreferenceRepository();
      const userPreference =
        await userPreferenceRepository.getUserPreference(userId);
      console.log(
        `[DEBUG IMAGE] User preference retrieved:`,
        JSON.stringify(userPreference, null, 2)
      );

      if (userPreference && userPreference.language) {
        userLanguage = userPreference.language;
        console.log(
          `[DEBUG IMAGE] Setting user language from preference: ${userLanguage}`
        );
      } else {
        console.log(
          `[DEBUG IMAGE] No language preference found in user data, using default: ${DEFAULT_LANGUAGE}`
        );
      }
    } catch (error) {
      console.error(
        `[DEBUG IMAGE] Failed to fetch user language preference:`,
        error
      );
      // Continue with default language
    }
  } else {
    console.log(
      `[DEBUG IMAGE] No userId provided, using default language: ${DEFAULT_LANGUAGE}`
    );
  }

  try {
    // Get checklist item
    const checkList = await checkRepository.findCheckListItemById(checkId);

    if (!checkList) {
      throw new Error(`Check list item not found: ${checkId}`);
    }

    // Get image files from S3
    const s3Client = new S3Client({});
    const bucketName = process.env.DOCUMENT_BUCKET || "";

    // Get up to 20 images
    const inputDocuments = documents; // Rename to avoid shadowing later variable
    const imageBuffers: Array<{
      documentId: string;
      filename: string;
      buffer: Uint8Array;
    }> = await Promise.all(
      inputDocuments
        .slice(0, 20)
        .map(
          async (doc: {
            id: string;
            filename: string;
            s3Path: string;
            fileType: string;
          }) => {
            const { Body } = await s3Client.send(
              new GetObjectCommand({
                Bucket: bucketName,
                Key: doc.s3Path,
              })
            );

            if (!Body) {
              throw new Error(`Image not found: ${doc.s3Path}`);
            }

            return {
              documentId: doc.id,
              filename: doc.filename,
              buffer: await Body.transformToByteArray(),
            };
          }
        )
    );

    // Prepare prompt based on user language
    console.log(
      `[DEBUG IMAGE] Processing check item ${checkId} for review result ${reviewResultId} with userId: ${userId}, user language: ${userLanguage}`
    );
    const imageReviewPrompt = getImageReviewPrompt(userLanguage);
    const prompt = imageReviewPrompt
      .replace("{checkName}", checkList.name)
      .replace(
        "{checkDescription}",
        checkList.description ||
          (userLanguage === "ja" ? "説明なし" : "No description")
      );

    // Use Bedrock for review
    const bedrockClient = new BedrockRuntimeClient({
      region: BEDROCK_REGION,
    });

    // Build message
    const messageContent: any[] = [{ text: prompt }];

    // Add images to message
    imageBuffers.forEach((img) => {
      const fileExtension = img.filename.split(".").pop()?.toLowerCase();
      const format = fileExtension === "png" ? "png" : "jpeg";

      messageContent.push({
        image: {
          format,
          source: {
            bytes: img.buffer,
          },
        },
      });
    });

    const response = await bedrockClient.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        messages: [
          {
            role: "user" as const,
            content: messageContent,
          },
        ],
        inferenceConfig: {
          maxTokens: 1000,
          temperature: 0.0,
          topP: 0.9,
        },
      })
    );

    // Extract text from response
    let llmResponse = "";
    if (response.output?.message?.content) {
      response.output.message.content.forEach((block) => {
        if ("text" in block) {
          llmResponse += block.text;
        }
      });
    }

    // Log cache metrics
    const usage = response.usage as TokenUsage;
    const inputTokens = usage?.inputTokens || 0;
    const latencyMs = response.metrics?.latencyMs || 0;

    console.log(
      `[Image Review] Input tokens: ${inputTokens}, Latency: ${latencyMs}ms, Check item ID: ${checkId}`
    );

    // Extract JSON response
    const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
    let reviewData;

    if (jsonMatch) {
      try {
        reviewData = JSON.parse(jsonMatch[0]);
      } catch (error) {
        // If JSON parsing fails, retry
        console.error("JSON parsing failed. Retrying...");

        // Retry prompt
        const retryPrompt = `
${prompt}

前回の応答を JSON として解析できませんでした。必ず有効な JSON オブジェクトのみを返してください。
マークダウンの記法（\`\`\`json など）は使用せず、純粋な JSON のみを返してください。
`;

        // Build retry message
        const retryMessageContent: any[] = [{ text: retryPrompt }];

        // Add images to retry message
        imageBuffers.forEach((img) => {
          const fileExtension = img.filename.split(".").pop()?.toLowerCase();
          const format = fileExtension === "png" ? "png" : "jpeg";

          retryMessageContent.push({
            image: {
              format,
              source: {
                bytes: img.buffer,
              },
            },
          });
        });

        const retryResponse = await bedrockClient.send(
          new ConverseCommand({
            modelId: MODEL_ID,
            messages: [
              {
                role: "user" as const,
                content: retryMessageContent,
              },
            ],
            inferenceConfig: {
              maxTokens: 1000,
              temperature: 0.0,
              topP: 0.9,
            },
          })
        );

        // Extract text from retry response
        let retryLlmResponse = "";
        if (retryResponse.output?.message?.content) {
          retryResponse.output.message.content.forEach((block) => {
            if ("text" in block) {
              retryLlmResponse += block.text;
            }
          });
        }

        const retryJsonMatch = retryLlmResponse.match(/\{[\s\S]*\}/);
        if (!retryJsonMatch) {
          throw new Error("Failed to extract JSON response even after retry.");
        }

        reviewData = JSON.parse(retryJsonMatch[0]);
      }
    } else {
      throw new Error("Failed to extract JSON response.");
    }

    // Update review results
    const current = await reviewResultRepository.findDetailedReviewResultById({
      resultId: reviewResultId,
    });

    // Convert image buffers to document info format
    const documentInfos = imageBuffers.map((img) => ({
      documentId: img.documentId,
      filename: img.filename,
    }));

    // Use the unified review data method
    const updated = ReviewResultDomain.fromReviewData({
      current,
      result: reviewData.result,
      confidenceScore: reviewData.confidence,
      explanation: reviewData.explanation,
      shortExplanation: reviewData.shortExplanation,
      documents: documentInfos,
      reviewType: "IMAGE",
      typeSpecificData: {
        usedImageIndexes: reviewData.usedImageIndexes,
        boundingBoxes: reviewData.boundingBoxes || [],
      },
    });
    await reviewResultRepository.updateResult({
      newResult: updated,
    });

    return {
      status: "success",
      reviewResultId,
      checkId,
      result: reviewData.result,
    };
  } catch (error) {
    console.error(
      `Error processing image review item ${reviewResultId}:`,
      error
    );

    // Update review job status to failed when error occurs
    const reviewJobRepository = await makePrismaReviewJobRepository();
    await reviewJobRepository.updateJobStatus({
      reviewJobId,
      status: REVIEW_JOB_STATUS.FAILED,
    });
    throw error;
  }
}
