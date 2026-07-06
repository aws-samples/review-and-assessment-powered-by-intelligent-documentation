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
      header: t("promptTemplate.name"),
      render: (template) => (
        <div className="text-sm font-medium text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
          {template.name}
        </div>
      ),
    },
    {
      key: "type",
      header: t("promptTemplate.type"),
      render: (template) => (
        <div className="text-sm text-aws-font-color-gray">
          {PROMPT_TYPE_LABELS[template.type] || template.type}
        </div>
      ),
    },
    {
      key: "description",
      header: t("promptTemplate.description"),
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
      header: t("promptTemplate.updatedAt"),
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
      label: t("common.edit"),
      onClick: onEdit,
      variant: "primary",
      outline: true,
      className: "transition-all duration-200",
    },
    {
      icon: <HiTrash className="mr-1 h-4 w-4" />,
      label: t("common.delete"),
      onClick: onDelete,
      variant: "danger",
      outline: true,
      className: "transition-all duration-200",
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
      emptyMessage={t("promptTemplate.noTemplates")}
      keyExtractor={(item) => item.id}
      onRowClick={handleRowClick}
      rowClickable={true}
    />
  );
};

export default PromptTemplateList;
