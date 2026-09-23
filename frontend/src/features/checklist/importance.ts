/**
 * チェック項目の重要度を画面に出すときの並び順・アイコン・文言のキー。
 * 色の違いだけに頼らないよう、段階ごとに形の違うアイコンを使う
 */
import {
  HiChevronDoubleUp,
  HiMinus,
  HiChevronDoubleDown,
} from "react-icons/hi";
import { CHECK_ITEM_IMPORTANCE } from "./types";

/** 画面に並べる順 */
export const IMPORTANCE_LEVELS = [
  CHECK_ITEM_IMPORTANCE.HIGH,
  CHECK_ITEM_IMPORTANCE.MEDIUM,
  CHECK_ITEM_IMPORTANCE.LOW,
];

export const IMPORTANCE_ICONS = {
  [CHECK_ITEM_IMPORTANCE.HIGH]: HiChevronDoubleUp,
  [CHECK_ITEM_IMPORTANCE.MEDIUM]: HiMinus,
  [CHECK_ITEM_IMPORTANCE.LOW]: HiChevronDoubleDown,
};

export const IMPORTANCE_LABEL_KEYS = {
  [CHECK_ITEM_IMPORTANCE.HIGH]: "checklist.importanceHigh",
  [CHECK_ITEM_IMPORTANCE.MEDIUM]: "checklist.importanceMedium",
  [CHECK_ITEM_IMPORTANCE.LOW]: "checklist.importanceLow",
};
