import json
import os
import time
import boto3
import logging
from botocore.exceptions import ClientError

# ロガー設定
logger = logging.getLogger()
logger.setLevel(os.environ.get('LOG_LEVEL', 'WARNING'))

# 既定値とキュー設定定数
DEFAULT_REVIEW_MAX_CONCURRENCY = 2
DEFAULT_MAX_QUEUE_COUNT_MS = 86_400_000  # 24h
SQS_WAIT_TIME_SECONDS = 0
MILLISECONDS_IN_SECOND = 1000

# 環境変数から取得する定数
STATE_MACHINE_ARN = os.environ['STATE_MACHINE_ARN']
SQS_QUEUE_URL = os.environ['QUEUE_URL']
REVIEW_MAX_CONCURRENCY = int(os.environ.get(
    'REVIEW_MAX_CONCURRENCY', str(DEFAULT_REVIEW_MAX_CONCURRENCY)))
MAX_QUEUE_COUNT = int(os.environ.get(
    'MAX_QUEUE_COUNT', str(DEFAULT_MAX_QUEUE_COUNT_MS)))
ERROR_LAMBDA_NAME = os.environ['ERROR_LAMBDA_NAME']

# 可視性タイムアウト設定（秒）
VISIBILITY_TIMEOUT_PROCESSING = 1200  # 20分
VISIBILITY_TIMEOUT_RETRY = 15  # 15秒

# AWSクライアント初期化
sfn_client = boto3.client('stepfunctions')
sqs_client = boto3.client('sqs')
lambda_client = boto3.client('lambda')


def lambda_handler(event, context):
    """
    SQSトリガーでStepFunctionを起動するLambda関数
    """

    running_count = get_running_executions_count()
    available_slots = REVIEW_MAX_CONCURRENCY - running_count

    logger.info('Running executions: %d, available slots: %d', running_count, available_slots)

    # SQSからメッセージ受信
    messages = event['Records']  # SQSイベントの Records からメッセージを取得

    if not messages:
        logger.info('No messages received')
        return {'statusCode': 200, 'body': 'No messages to process'}

    if available_slots <= 0:
        # 空き枠がないため、各メッセージの可視性タイムアウトを15秒に短縮（再試行を促す）
        for message in messages:
            # 可視性タイムアウトを15秒に修正
            change_message_visibility(
                message['receiptHandle'], VISIBILITY_TIMEOUT_RETRY)
        err_msg = 'No available slots'
        logger.error(err_msg)
        raise Exception(err_msg)

    logger.info('Received messages: %d', len(messages))

    # 各メッセージの処理
    for message in messages:
        execute_review_workflow_for_message(message)

    return {'statusCode': 200, 'body': 'Processing completed'}


def get_running_executions_count():
    """実行中のStepFunction数を取得"""
    try:
        response = sfn_client.list_executions(
            stateMachineArn=STATE_MACHINE_ARN, statusFilter='RUNNING', maxResults=REVIEW_MAX_CONCURRENCY + 1
        )
        return len(response.get('executions', []))
    except ClientError:
        error_message = {
            'state_machine_arn': STATE_MACHINE_ARN,
            'status_filter': 'RUNNING',
            'max_results': REVIEW_MAX_CONCURRENCY + 1,
        }
        err_msg = 'ListExecutions API error: ' + 
            json.dumps(error_message, ensure_ascii=False, indent=2)
        raise Exception(err_msg)


def receive_messages(max_messages):
    """SQSからメッセージを受信"""
    try:
        response = sqs_client.receive_message(
            QueueUrl=SQS_QUEUE_URL, MaxNumberOfMessages=max_messages, WaitTimeSeconds=SQS_WAIT_TIME_SECONDS
        )
        return response.get('Messages', [])
    except ClientError:
        error_message = {'queue_url': SQS_QUEUE_URL, 'max_number_of_messages': max_messages,
                         'wait_time_seconds': SQS_WAIT_TIME_SECONDS}
        err_msg = 'ReceiveMessage API error: ' + 
            json.dumps(error_message, ensure_ascii=False, indent=2)
        raise Exception(err_msg)


def change_message_visibility(receipt_handle, timeout_seconds):
    """メッセージの可視性タイムアウトを変更"""
    try:
        sqs_client.change_message_visibility(
            QueueUrl=SQS_QUEUE_URL, ReceiptHandle=receipt_handle, VisibilityTimeout=timeout_seconds
        )
        logger.info('Changed visibility timeout to %d seconds', timeout_seconds)
    except ClientError:
        error_message = {
            'queue_url': SQS_QUEUE_URL,
            'receipt_handle': receipt_handle,
            'visibility_timeout': timeout_seconds,
        }
        logger.exception('Failed to change visibility timeout: %s', json.dumps(
            error_message, ensure_ascii=False, indent=2))


def execute_review_workflow_for_message(message):
    """個別メッセージの処理"""
    receipt_handle = message['receiptHandle']
    message_body = message['body']
    sqs_message_id = message['messageId']
    sent_timestamp = message['attributes']['SentTimestamp']
    queue_wait_ms = int(
        time.time() * MILLISECONDS_IN_SECOND - float(sent_timestamp))

    # キュー滞留時間（ミリ秒）
    logger.info('Queue wait time (ms): %d', queue_wait_ms)

    if queue_wait_ms >= MAX_QUEUE_COUNT:
        body = json.loads(message_body)
        jobs = body.get('jobs', {})

        # 未処理のキューとして消費する
        consume_unprocessed_queue(
            receipt_handle=receipt_handle, review_jobs=jobs)
        error_message = {'sqs_message_id': sqs_message_id,
                         'review_jobs': jobs, 'user_email': body.get('mail_to', '')}
        logger.error(
            'Queue wait time exceeded threshold %d (ms): %s',
            MAX_QUEUE_COUNT,
            json.dumps(error_message, ensure_ascii=False, indent=2),
        )
        return

    # ①まず可視性タイムアウトを20分に延長
    change_message_visibility(receipt_handle, VISIBILITY_TIMEOUT_PROCESSING)

    try:
        # メッセージIDの確認と処理開始ログ

        if not sqs_message_id:
            logger.warning('sqs_message_id not found')
            return

        logger.info('Start processing: %s', sqs_message_id)

        # StepFunction実行
        execution_arn = start_stepfunction_execution(
            sqs_message_id, message_body)
        logger.info('Step Function execution started: %s', execution_arn)

        # 処理成功 - メッセージ削除
        delete_message(receipt_handle)
        logger.info('Processing completed: %s', sqs_message_id)

    except ClientError as e:
        error_code = e.response['Error']['Code']

        # StepFunction実行済みの場合はメッセージ削除
        if error_code == 'ExecutionAlreadyExists':
            logger.info('Step Function execution already exists: %s', sqs_message_id)
            delete_message(receipt_handle)
        # その他のエラーは②可視性タイムアウトを15秒に変更して再試行
        else:
            err_msg = f"Processing error sqs_message_id: {sqs_message_id}, error_code: {error_code}"
            change_message_visibility(receipt_handle, VISIBILITY_TIMEOUT_RETRY)
            raise Exception(err_msg)
    except Exception:
        # その他の予期しないエラーは②可視性タイムアウトを15秒に変更して再試行
        err_msg = f"Unexpected error: sqs_message_id: {sqs_message_id}"
        change_message_visibility(receipt_handle, VISIBILITY_TIMEOUT_RETRY)
        raise Exception(err_msg)


def start_stepfunction_execution(sqs_message_id, message_body):
    """StepFunctionを実行"""
    response = sfn_client.start_execution(
        stateMachineArn=STATE_MACHINE_ARN, name=sqs_message_id, input=message_body)
    return response['executionArn']


def consume_unprocessed_queue(receipt_handle: str, review_jobs: list[dict]):
    """タイムアウトした未処理メッセージを削除し、エラー処理を実行

    一定時間以上処理されなかったキューメッセージを削除し、
    エラーハンドラーLambdaを呼び出して失敗ステータスに移行させます。

    Args:
        receipt_handle (str): 削除対象のSQSメッセージハンドル
        review_jobs (list[dict]): レビュージョブ情報（reviewJobId等）
    """
    delete_message(receipt_handle)
    for job in review_jobs:
        error_event = {
            'error': 'QUEUE_TIMEOUT_ERROR',
            'reviewJobId': job.get('reviewJobId', ''),
            'action': 'handleReviewError',
        }
        lambda_client.invoke(FunctionName=ERROR_LAMBDA_NAME,
                             Payload=json.dumps(error_event, ensure_ascii=False))


def delete_message(receipt_handle):
    """SQSメッセージを削除"""
    try:
        sqs_client.delete_message(
            QueueUrl=SQS_QUEUE_URL, ReceiptHandle=receipt_handle)
        logger.info('SQS message deleted')
    except ClientError as e:
        logger.exception('Failed to delete message: %s', e)
