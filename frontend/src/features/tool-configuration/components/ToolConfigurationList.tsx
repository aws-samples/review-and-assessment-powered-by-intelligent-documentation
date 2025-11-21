import React from "react";
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
  const { showConfirm, showError, AlertModal } = useAlert();

  const handleRowClick = (item: ToolConfiguration) => {
    window.location.href = `/tool-configurations/${item.id}`;
  };

  const handleDelete = (item: ToolConfiguration, e: React.MouseEvent) => {
    if ((item.usageCount ?? 0) > 0) {
      showError("Cannot delete tool configuration that is in use");
      return;
    }

    showConfirm(`Delete "${item.name}"?`, {
      title: "Confirm",
      confirmButtonText: "Delete",
      onConfirm: async () => {
        try {
          await onDelete(item.id, item.name);
        } catch (error) {
          showError(`Failed to delete "${item.name}"`);
        }
      },
    });
  };

  const columns: TableColumn<ToolConfiguration>[] = [
    {
      key: "name",
      header: "Name",
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
      header: "Tools",
      render: (item) => {
        const tools = [];
        if (item.knowledgeBase && item.knowledgeBase.length > 0) {
          tools.push(`KB (${item.knowledgeBase.length})`);
        }
        if (item.codeInterpreter) {
          tools.push("Code Interpreter");
        }
        if (item.mcpConfig) {
          tools.push("MCP");
        }
        return (
          <div className="text-sm text-aws-font-color-gray">
            {tools.join(", ") || "None"}
          </div>
        );
      },
    },
    {
      key: "usageCount",
      header: "Usage",
      render: (item) => (
        <div className="flex items-center gap-2">
          {(item.usageCount ?? 0) > 0 && (
            <HiLockClosed className="h-5 w-5 text-aws-font-color-gray" />
          )}
          <span className="text-sm text-aws-font-color-gray">
            Used by {item.usageCount ?? 0} items
          </span>
        </div>
      ),
    },
  ];

  const actions: TableAction<ToolConfiguration>[] = [
    {
      icon: <HiEye className="mr-1 h-4 w-4" />,
      label: "Details",
      onClick: (item) => {
        window.location.href = `/tool-configurations/${item.id}`;
      },
      variant: "primary",
      outline: true,
      className: "transition-all duration-200",
    },
    {
      icon: <HiTrash className="mr-1 h-4 w-4" />,
      label: "Delete",
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
        emptyMessage="No tool configurations found"
        keyExtractor={(item) => item.id}
        onRowClick={handleRowClick}
        rowClickable={true}
      />
      <AlertModal />
    </>
  );
}
