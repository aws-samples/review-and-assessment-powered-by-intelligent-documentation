import json
import logging
import os
import time

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(os.environ.get("LOG_LEVEL", "WARNING"))

DEFAULT_REVIEW_MAX_CONCURRENCY = 2
DEFAULT_MAX_QUEUE_WAIT_MS = 86_400_000
DEFAULT_VISIBILITY_TIMEOUT_PROCESSING = 1200
DEFAULT_VISIBILITY_TIMEOUT_RETRY = 15
MILLISECONDS_IN_SECOND = 1000

STATE_MACHINE_ARN = os.environ["STATE_MACHINE_ARN"]
REVIEW_QUEUE_URL = os.environ["REVIEW_QUEUE_URL"]
ERROR_LAMBDA_NAME = os.environ["ERROR_LAMBDA_NAME"]

REVIEW_MAX_CONCURRENCY = int(
    os.environ.get("REVIEW_MAX_CONCURRENCY", str(DEFAULT_REVIEW_MAX_CONCURRENCY))
)
MAX_QUEUE_WAIT_MS = int(
    os.environ.get("MAX_QUEUE_COUNT", str(DEFAULT_MAX_QUEUE_WAIT_MS))
)
VISIBILITY_TIMEOUT_PROCESSING = int(
    os.environ.get(
        "VISIBILITY_TIMEOUT_PROCESSING", str(DEFAULT_VISIBILITY_TIMEOUT_PROCESSING)
    )
)
VISIBILITY_TIMEOUT_RETRY = int(
    os.environ.get("VISIBILITY_TIMEOUT_RETRY", str(DEFAULT_VISIBILITY_TIMEOUT_RETRY))
)

sfn_client = boto3.client("stepfunctions")
sqs_client = boto3.client("sqs")
lambda_client = boto3.client("lambda")


def lambda_handler(event, context):
    messages = event.get("Records", [])
    if not messages:
        logger.info("No messages received")
        return {"batchItemFailures": []}

    running_count = get_running_executions_count()
    available_slots = max(REVIEW_MAX_CONCURRENCY - running_count, 0)
    logger.info(
        "Running executions: %d, available slots: %d",
        running_count,
        available_slots,
    )

    batch_failures = []

    for message in messages:
        message_id = message.get("messageId", "")
        if available_slots <= 0:
            reschedule_message(message, VISIBILITY_TIMEOUT_RETRY)
            if message_id:
                batch_failures.append({"itemIdentifier": message_id})
            continue

        if process_message(message):
            available_slots -= 1
        else:
            if message_id:
                batch_failures.append({"itemIdentifier": message_id})

    if batch_failures:
        logger.info("Returning %d batch item failures", len(batch_failures))

    return {"batchItemFailures": batch_failures}


def process_message(message):
    message_id = message.get("messageId", "")
    receipt_handle = message.get("receiptHandle", "")
    message_body = message.get("body", "")

    try:
        body = json.loads(message_body)
    except json.JSONDecodeError:
        logger.error("Invalid message body: %s", message_body)
        return True

    review_job_id = body.get("reviewJobId")
    user_id = body.get("userId")

    queue_wait_ms = get_queue_wait_ms(message)
    logger.info("Queue wait time (ms): %d", queue_wait_ms)

    if queue_wait_ms >= MAX_QUEUE_WAIT_MS:
        handle_queue_timeout(message_id, review_job_id, user_id)
        return True

    change_message_visibility(receipt_handle, VISIBILITY_TIMEOUT_PROCESSING)

    if not message_id:
        logger.warning("Message ID not found")
        return True

    try:
        execution_arn = start_stepfunction_execution(message_id, message_body)
        logger.info("Step Function execution started: %s", execution_arn)
        return True
    except ClientError as error:
        error_code = error.response.get("Error", {}).get("Code", "Unknown")
        if error_code == "ExecutionAlreadyExists":
            logger.info("Step Function execution already exists: %s", message_id)
            return True
        logger.exception(
            "Failed to start Step Function execution: %s", error_code
        )
        change_message_visibility(receipt_handle, VISIBILITY_TIMEOUT_RETRY)
        return False
    except Exception:
        logger.exception("Unexpected error while processing message: %s", message_id)
        change_message_visibility(receipt_handle, VISIBILITY_TIMEOUT_RETRY)
        return False


def get_queue_wait_ms(message):
    sent_timestamp = message.get("attributes", {}).get("SentTimestamp")
    if not sent_timestamp:
        return 0
    return int(time.time() * MILLISECONDS_IN_SECOND - float(sent_timestamp))


def get_running_executions_count():
    try:
        response = sfn_client.list_executions(
            stateMachineArn=STATE_MACHINE_ARN,
            statusFilter="RUNNING",
            maxResults=REVIEW_MAX_CONCURRENCY + 1,
        )
        return len(response.get("executions", []))
    except ClientError:
        logger.exception("Failed to list Step Functions executions")
        return REVIEW_MAX_CONCURRENCY


def reschedule_message(message, timeout_seconds):
    receipt_handle = message.get("receiptHandle", "")
    if not receipt_handle:
        return
    change_message_visibility(receipt_handle, timeout_seconds)


def change_message_visibility(receipt_handle, timeout_seconds):
    if not receipt_handle:
        return
    try:
        sqs_client.change_message_visibility(
            QueueUrl=REVIEW_QUEUE_URL,
            ReceiptHandle=receipt_handle,
            VisibilityTimeout=timeout_seconds,
        )
        logger.info("Changed visibility timeout to %d seconds", timeout_seconds)
    except ClientError:
        logger.exception("Failed to change visibility timeout")


def start_stepfunction_execution(message_id, message_body):
    response = sfn_client.start_execution(
        stateMachineArn=STATE_MACHINE_ARN,
        name=message_id,
        input=message_body,
    )
    return response["executionArn"]


def handle_queue_timeout(message_id, review_job_id, user_id):
    if not review_job_id:
        logger.error(
            "Queue wait time exceeded, but reviewJobId is missing (message_id=%s)",
            message_id,
        )
        return

    error_event = {
        "action": "handleReviewError",
        "reviewJobId": review_job_id,
        "error": "QUEUE_TIMEOUT_ERROR",
    }
    if user_id:
        error_event["userId"] = user_id

    lambda_client.invoke(
        FunctionName=ERROR_LAMBDA_NAME,
        Payload=json.dumps(error_event),
    )

    logger.error(
        "Queue wait time exceeded threshold %d (ms) for reviewJobId=%s",
        MAX_QUEUE_WAIT_MS,
        review_job_id,
    )
