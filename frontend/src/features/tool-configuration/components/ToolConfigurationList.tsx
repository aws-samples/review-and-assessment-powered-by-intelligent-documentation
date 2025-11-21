import React from "react";
import { useTranslation } from "react-i18next";
import { HiTrash, HiLockClosed, HiEye } from "react-icons/hi";
import { ToolConfiguration } from "../types";
import Table, { TableColumn, TableAction } from "../../../components/Table";
import { useAlert } from "../../../hooks/useAlert";

type ToolConfigurationListProps = {
  toolConfigurations: ToolConfiguration[];
  isLoading: boolean;
  onDelete: (id: string, name: string) => Promise<void>;
};

export default function ToolConfigurationList({
  toolConfigurations,
  isLoading,
  onDelete,
}: ToolConfigurationListProps) {
  const { t } = useTranslation();
  const { showConfirm, showError, AlertModal } = useAlert();

  const handleRowClick = (item: ToolConfiguration) => {
    window.location.href = `/tool-configurations/${item.id}`;
  };

  const handleDelete = (item: ToolConfiguration, e: React.MouseEvent) => {
    if ((item.usageCount ?? 0) > 0) {
      showError(t("toolConfiguration.deleteError"));
      return;
    }

    showConfirm(t("toolConfiguration.deleteConfirmation", { name: item.name }), {
      title: t("toolConfiguration.deleteTitle"),
      confirmButtonText: t("toolConfiguration.deleteButton"),
      onConfirm: async () => {
        try {
          await onDelete(item.id, item.name);
        } catch (error) {
          showError(t("toolConfiguration.deleteError"));
        }
      },
    });
  };

  const columns: TableColumn<ToolConfiguration>[] = [
    {
      key: "name",
      header: t("toolConfiguration.name"),
      render: (item) => (
        <div>
          <div className="text-sm font-medium text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
            {item.name}
          </div>
          {item.description && (
            <div className="text-sm text-aws-font-color-gray">
              {item.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "tools",
      header: t("toolConfiguration.tools"),
      render: (item) => {
        const tools = [];
        if (item.knowledgeBase && item.knowledgeBase.length > 0) {
          tools.push(`KB (${item.knowledgeBase.length})`);
        }
        if (item.codeInterpreter) {
          tools.push(t("toolConfiguration.codeInterpreter"));
        }
        if (item.mcpConfig) {
          tools.push(t("toolConfiguration.mcp"));
        }
        return (
          <div className="text-sm text-aws-font-color-gray">
            {tools.join(", ") || t("review.noDocuments")}
          </div>
        );
      },
    },
    {
      key: "usageCount",
      header: t("toolConfiguration.usage"),
      render: (item) => (
        <div className="flex items-center gap-2">
          {(item.usageCount ?? 0) > 0 && (
            <HiLockClosed className="h-5 w-5 text-aws-font-color-gray" />
          )}
          <span className="text-sm text-aws-font-color-gray">
            {t("toolConfiguration.usedBy", { count: item.usageCount ?? 0 })}
          </span>
        </div>
      ),
    },
  ];

  const actions: TableAction<ToolConfiguration>[] = [
    {
      icon: <HiEye className="mr-1 h-4 w-4" />,
      label: t("common.details"),
      onClick: (item) => {
        window.location.href = `/tool-configurations/${item.id}`;
      },
      variant: "primary",
      outline: true,
      className: "transition-all duration-200",
    },
    {
      icon: <HiTrash className="mr-1 h-4 w-4" />,
      label: t("common.delete"),
      onClick: handleDelete,
      disabled: (item) => (item.usageCount ?? 0) > 0,
      variant: "danger",
      outline: true,
      className: "transition-all duration-200",
    },
  ];

  return (
    <>
      <Table
        items={toolConfigurations}
        columns={columns}
        actions={actions}
        isLoading={isLoading}
        emptyMessage={t("toolConfiguration.noConfigurations")}
        keyExtractor={(item) => item.id}
        onRowClick={handleRowClick}
        rowClickable={true}
      />
      <AlertModal />
    </>
  );
}
