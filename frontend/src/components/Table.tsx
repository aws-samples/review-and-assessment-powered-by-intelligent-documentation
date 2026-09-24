import React, { MouseEvent } from "react";
import { HiInformationCircle } from "react-icons/hi";
import { useTranslation } from "react-i18next";
import Button from "./Button";
import { TableSkeleton } from "./Skeleton";
import { ErrorAlert } from "./ErrorAlert";
import { InfoAlert } from "./InfoAlert";

// Column definition for table
export interface TableColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  width?: string;
}

// Action definition for table rows
export interface TableAction<T> {
  icon: React.ReactNode;
  label: string;
  onClick: (item: T, e: React.MouseEvent) => void;
  disabled?: (item: T) => boolean;
  show?: (item: T) => boolean;
  variant?: "primary" | "secondary" | "danger" | "text";
  outline?: boolean;
  className?: string;
}

// Props for the Table component
export interface TableProps<T> {
  items: T[];
  columns: TableColumn<T>[];
  actions?: TableAction<T>[];
  isLoading?: boolean;
  error?: string | Error | null;
  emptyMessage?: string;
  title?: string;
  description?: string;
  onRowClick?: (item: T) => void;
  keyExtractor: (item: T) => string | number;
  rowClassName?: (item: T) => string;
  rowClickable?: boolean; // Explicitly mark rows as clickable
}

/**
 * Generic Table component that can be used across the application
 */
export function Table<T>({
  items,
  columns,
  actions,
  isLoading,
  error,
  emptyMessage = "No items found",
  title,
  description,
  onRowClick,
  keyExtractor,
  rowClassName,
  rowClickable,
}: TableProps<T>) {
  const { t } = useTranslation();
  // Show loading state
  if (isLoading) {
    return (
      <TableSkeleton rows={5} columns={columns.length + (actions ? 1 : 0)} />
    );
  }

  // Show error state
  if (error) {
    return <ErrorAlert error={error} />;
  }

  // Show empty state
  if (!items || items.length === 0) {
    return <InfoAlert message={emptyMessage} variant="info" />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-light-gray bg-white shadow-md dark:bg-aws-squid-ink-dark">
      {/* Optional header section */}
      {(title || description) && (
        <div className="border-b border-light-gray p-4">
          {title && (
            <h3 className="text-lg font-medium text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
              {title}
            </h3>
          )}
          {description && (
            <p className="mt-1 text-sm text-aws-font-color-gray">
              {description}
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto p-2">
        <table className="min-w-full divide-y divide-light-gray">
          {/* 列の意味が分かるように見出しを出す。列定義の header は元からある */}
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={`header-${column.key}`}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-aws-font-color-gray">
                  {column.header}
                </th>
              ))}
              {actions && actions.length > 0 && (
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-aws-font-color-gray">
                  {t("table.actions")}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-light-gray bg-white dark:bg-aws-squid-ink-dark">
            {items.map((item) => {
              const key = keyExtractor(item);
              const isClickable = onRowClick || rowClickable;
              const baseRowClass =
                "transition-colors hover:bg-aws-paper-light dark:hover:bg-aws-paper-dark";
              const clickableClass = isClickable
                ? "cursor-pointer hover:shadow-sm"
                : "";
              const customRowClass = rowClassName ? rowClassName(item) : "";

              return (
                <tr
                  key={key}
                  className={`${baseRowClass} ${customRowClass} ${clickableClass}`}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}>
                  {columns.map((column) => (
                    <td key={`${key}-${column.key}`} className="px-6 py-4">
                      {column.render ? (
                        column.render(item)
                      ) : (
                        <div className="text-sm text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
                          {String((item as any)[column.key] || "")}
                        </div>
                      )}
                    </td>
                  ))}
                  {actions && actions.length > 0 && (
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <div className="flex items-center justify-end space-x-3">
                        {actions
                          .filter((action) =>
                            action.show ? action.show(item) : true
                          )
                          .map((action, idx) => {
                            const isDisabled = action.disabled
                              ? action.disabled(item)
                              : false;

                            return (
                              <Button
                                key={`${key}-action-${idx}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  action.onClick(item, e);
                                }}
                                variant={action.variant || "primary"}
                                outline={
                                  action.outline !== undefined
                                    ? action.outline
                                    : true
                                }
                                size="sm"
                                icon={action.icon}
                                disabled={isDisabled}
                                className={`${action.className || ""}`}>
                                {action.label}
                              </Button>
                            );
                          })}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;
