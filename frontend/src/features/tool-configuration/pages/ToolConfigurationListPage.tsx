import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HiPlus } from "react-icons/hi";
import { useToolConfigurations } from "../hooks/useToolConfigurationQueries";
import { useDeleteToolConfiguration } from "../hooks/useToolConfigurationMutations";
import ToolConfigurationList from "../components/ToolConfigurationList";
import Button from "../../../components/Button";

export default function ToolConfigurationListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { toolConfigurations, isLoading, refetch } = useToolConfigurations();
  const { deleteToolConfiguration } = useDeleteToolConfiguration();

  // 画面表示時またはlocationが変わった時にデータを再取得
  useEffect(() => {
    refetch();
  }, [location, refetch]);

  const handleDelete = async (id: string, name: string) => {
    await deleteToolConfiguration(id);
    refetch();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("toolConfiguration.title")}</h1>
        <Button onClick={() => navigate("/tool-configurations/new")}>
          <HiPlus className="mr-2 h-5 w-5" />
          {t("toolConfiguration.create")}
        </Button>
      </div>

      <ToolConfigurationList
        toolConfigurations={toolConfigurations}
        isLoading={isLoading}
        onDelete={handleDelete}
      />
    </div>
  );
}
