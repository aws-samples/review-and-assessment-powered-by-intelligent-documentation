import {
  SQSClient,
  SendMessageCommand,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";
import { ApplicationError } from "./errors";

// Singleton SQS client instance
let sqsClient: SQSClient | null = null;

/**
 * Get SQS client instance
 * @returns SQS client instance
 */
export function getSqsClient(): SQSClient {
  if (!sqsClient) {
    sqsClient = new SQSClient({
      region: process.env.AWS_REGION || "ap-northeast-1",
    });
  }
  return sqsClient;
}

/**
 * Send message to SQS queue
 * @param queueUrl Queue URL to send message to
 * @param messageBody Message body as object
 */
export async function sendMessage(
  queueUrl: string,
  messageBody: Record<string, any>,
  messageGroupId?: string
): Promise<void> {
  const client = getSqsClient();
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(messageBody),
    ...(messageGroupId ? { MessageGroupId: messageGroupId } : {}),
  });

  const response = await client.send(command);

  if (response.$metadata.httpStatusCode !== 200) {
    throw new ApplicationError(`Failed to send SQS message: ${response}`);
  }
}

/**
 * Get approximate queue depth for SQS queue
 * @param queueUrl URL of SQS queue
 * @returns Object with visible, notVisible, and total message counts
 */
export async function getQueueDepth(
  queueUrl: string
): Promise<{ visible: number; notVisible: number; total: number }> {
  const client = getSqsClient();
  const command = new GetQueueAttributesCommand({
    QueueUrl: queueUrl,
    AttributeNames: [
      "ApproximateNumberOfMessages",
      "ApproximateNumberOfMessagesNotVisible",
    ],
  });

  try {
    const response = await client.send(command);

    const visible = Number(
      response.Attributes?.ApproximateNumberOfMessages ?? 0
    );
    const notVisible = Number(
      response.Attributes?.ApproximateNumberOfMessagesNotVisible ?? 0
    );
    const total = visible + notVisible;

    return { visible, notVisible, total };
  } catch (error) {
    // Wrap or rethrow as ApplicationError for consistency
    throw new ApplicationError(
      `Failed to get SQS queue attributes for ${queueUrl}: ${String(error)}`
    );
  }
}
