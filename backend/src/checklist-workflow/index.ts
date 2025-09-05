/**
 * Lambda ハンドラー - Step Functionsからのイベントを処理
 */
import { processDocument } from "./document-processing";
import { processWithLLM } from "./document-processing/llm-processing";
import { aggregatePageResults } from "./aggregate-results";
import { storeChecklistItemsToDb } from "./store-to-db";
import { checklistErrorHandler } from "./handle-error";
import { detectAmbiguity } from "./ambiguity-detection";

export const handler = async (event: any): Promise<any> => {
  console.log("受信イベント:", JSON.stringify(event, null, 2));

  // アクションタイプに基づいて処理を分岐
  switch (event.action) {
    case "processDocument":
      return await handleProcessDocument(event);
    case "processWithLLM":
      return await handleProcessWithLLM(event);
    case "aggregatePageResults":
      return await handleAggregatePageResults(event);
    case "storeToDb":
      return await handleStoreToDb(event);
    case "detectAmbiguity":
      return await handleDetectAmbiguity(event);
    case "handleError":
      return await handleError(event);
    default:
      throw new Error(`未知のアクション: ${event.action}`);
  }
};

/**
 * ドキュメント処理ハンドラー
 */
async function handleProcessDocument(event: any) {
  return await processDocument({
    documentId: event.documentId,
    fileName: event.fileName,
  });
}

/**
 * LLM処理ハンドラー
 */
async function handleProcessWithLLM(event: any) {
  return await processWithLLM({
    documentId: event.documentId,
    pageNumber: event.pageNumber,
    userId: event.userId,
  });
}

/**
 * 結果集計ハンドラー
 */
async function handleAggregatePageResults(event: any) {
  return await aggregatePageResults({
    documentId: event.documentId,
    processedPages: event.processedPages,
  });
}

/**
 * RDBへの格納ハンドラー
 */
async function handleStoreToDb(event: any) {
  return await storeChecklistItemsToDb({
    documentId: event.documentId,
    checkListSetId: event.checkListSetId,
  });
}

/**
 * 曖昧さ検知ハンドラー
 */
async function handleDetectAmbiguity(event: any) {
  return await detectAmbiguity({
    checkListSetId: event.checkListSetId,
    userId: event.userId,
  });
}

/**
 * エラーハンドリングハンドラー
 */
async function handleError(event: any) {
  console.error("エラー発生:", event.error);
  await checklistErrorHandler(event);
  return {
    status: "error",
    error: event.error,
    documentId: event.documentId,
  };
}
