import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
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
  messageBody: Record<string, any>
): Promise<void> {
  const client = getSqsClient();
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(messageBody),
  });

  const response = await client.send(command);

  if (response.$metadata.httpStatusCode !== 200) {
    throw new ApplicationError(`Failed to send SQS message: ${response}`);
  }
}
