/**
 * タグの種類
 */
export type ExampleTag =
  | "real-estate"
  | "it-department"
  | "manufacturing"
  | "sustainability"
  | "corporate-governance"
  | "healthcare";

/**
 * ファイルの種類
 */
export type FileType = "checklist" | "review" | "knowledge";

/**
 * サンプルファイル
 */
export interface ExampleFile {
  id: string;
  name: string;
  type: FileType;
  url: string;
  imagePath?: string; // 画像パス (800x1200px) - グリッドとモーダル両方で使用
}

/**
 * サンプルユースケース
 */
export interface Example {
  id: string;
  name: string;
  tags: ExampleTag[];
  description: string;
  hasKnowledgeBase?: boolean;
  githubUrl?: string;
  files: ExampleFile[];
}

/**
 * 言語別のサンプルデータ
 */
export interface ExamplesMetadata {
  en: Example[];
  ja: Example[];
}
