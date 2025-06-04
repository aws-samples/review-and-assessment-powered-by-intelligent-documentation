import React from "react";
import { HiPencil, HiTrash, HiInformationCircle } from "react-icons/hi";
import { useTranslation } from "react-i18next";
import { PromptTemplate } from "../types";
import { PROMPT_TYPE_LABELS } from "../constants";
import Table, { TableColumn, TableAction } from "../../../components/Table";

interface PromptTemplateListProps {
  templates: PromptTemplate[];
  onEdit: (template: PromptTemplate) => void;
  onDelete: (template: PromptTemplate) => void;
  onSetDefault: (template: PromptTemplate) => void;
  onCreateNew: () => void;
  isLoading: boolean;
}

export const PromptTemplateList: React.FC<PromptTemplateListProps> = ({
  templates,
  onEdit,
  onDelete,
  onSetDefault,
  onCreateNew,
  isLoading,
}) => {
  const { t } = useTranslation();
  // Define columns
  const columns: TableColumn<PromptTemplate>[] = [
    {
      key: "name",
      header: t("promptTemplate.name", "名前"),
      render: (template) => (
        <div className="text-sm font-medium text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
          {template.name}
        </div>
      ),
    },
    {
      key: "type",
      header: t("promptTemplate.type", "タイプ"),
      render: (template) => (
        <div className="text-sm text-aws-font-color-gray">
          {PROMPT_TYPE_LABELS[template.type] || template.type}
        </div>
      ),
    },
    {
      key: "description",
      header: t("promptTemplate.description", "説明"),
      render: (template) => (
        <div
          className="max-w-xs truncate text-sm text-aws-font-color-gray"
          title={template.description || ""}>
          {template.description || "-"}
        </div>
      ),
    },
    {
      key: "updatedAt",
      header: t("promptTemplate.updatedAt", "最終更新"),
      render: (template) => (
        <div className="text-sm text-aws-font-color-gray">
          {new Date(template.updatedAt).toLocaleString()}
        </div>
      ),
    },
  ];

  // Define actions
  const actions: TableAction<PromptTemplate>[] = [
    {
      icon: <HiPencil className="mr-1 h-4 w-4" />,
      label: t("common.edit", "編集"),
      onClick: onEdit,
      className: "text-aws-font-color-blue hover:text-aws-sea-blue-light",
    },
    {
      icon: <HiTrash className="mr-1 h-4 w-4" />,
      label: t("common.delete", "削除"),
      onClick: onDelete,
      className: "text-red hover:text-light-red",
    },
  ];

  // Handle row click to edit the template
  const handleRowClick = (template: PromptTemplate) => {
    onEdit(template);
  };

  return (
    <Table
      items={templates}
      columns={columns}
      actions={actions}
      isLoading={isLoading}
      emptyMessage={t(
        "promptTemplate.noTemplates",
        "テンプレートがありません。新規作成してください。"
      )}
      keyExtractor={(item) => item.id}
      onRowClick={handleRowClick}
      rowClickable={true}
    />
  );
};

export default PromptTemplateList;
