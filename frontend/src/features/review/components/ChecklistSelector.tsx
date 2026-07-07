import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckListSet } from "../../../features/checklist/types";
import Pagination from "../../../components/Pagination";

interface ChecklistSelectorProps {
  checklists: CheckListSet[];
  selectedChecklistId: string | null;
  onSelectChecklist: (checklist: CheckListSet) => void;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export const ChecklistSelector: React.FC<ChecklistSelectorProps> = ({
  checklists,
  selectedChecklistId,
  onSelectChecklist,
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-light-gray bg-white shadow-sm dark:bg-aws-squid-ink-dark">
      <div className="border-b border-light-gray p-4">
        <h3 className="text-lg font-medium text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
          {t("review.checklistSelection")}
        </h3>
        <p className="mt-1 text-sm text-aws-font-color-gray">
          {t("review.selectChecklistPrompt")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2 border-t-2"></div>
        </div>
      ) : (
        <>
          <div className="divide-y divide-light-gray">
            {checklists.map((checklist) => (
              <div
                key={checklist.id}
                className={`cursor-pointer p-4 transition-colors ${
                  selectedChecklistId === checklist.id
                    ? "bg-aws-sea-blue-light bg-opacity-10"
                    : "hover:bg-aws-paper-light"
                }`}
                onClick={() => onSelectChecklist(checklist)}>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id={`checklist-${checklist.id}`}
                    name="checklist"
                    checked={selectedChecklistId === checklist.id}
                    onChange={() => onSelectChecklist(checklist)}
                    className="h-4 w-4 text-aws-sea-blue-light focus:ring-aws-sea-blue-light"
                  />
                  <label
                    htmlFor={`checklist-${checklist.id}`}
                    className="ml-3 block cursor-pointer text-aws-squid-ink-light dark:text-aws-font-color-white-dark">
                    <span className="font-medium">{checklist.name}</span>
                    <p className="mt-1 text-sm text-aws-font-color-gray">
                      {checklist.description}
                    </p>
                    <p className="mt-1 text-xs text-aws-font-color-gray">
                      {t("review.status")}: {checklist.processingStatus}
                    </p>
                  </label>
                </div>
              </div>
            ))}
          </div>

          {checklists.length === 0 && (
            <div className="p-4 text-center text-aws-font-color-gray">
              {t("review.noChecklistsAvailable")}
            </div>
          )}

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={onPageChange}
              isLoading={isLoading}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ChecklistSelector;
