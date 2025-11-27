import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCreateToolConfiguration } from "../hooks/useToolConfigurationMutations";
import ToolConfigurationForm from "../components/ToolConfigurationForm";
import { CreateToolConfigurationRequest } from "../types";
import PageHeader from "../../../components/PageHeader";

export default function CreateToolConfigurationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createToolConfiguration } = useCreateToolConfiguration();

  const handleSubmit = async (data: CreateToolConfigurationRequest) => {
    await createToolConfiguration(data);
    navigate("/tool-configurations");
  };

  const handleCancel = () => {
    navigate("/tool-configurations");
  };

  return (
    <div>
      <PageHeader
        title={t("toolConfiguration.createTitle")}
        description={t("toolConfiguration.createDescription")}
        backLink={{
          to: "/tool-configurations",
          label: t("toolConfiguration.backToList"),
        }}
      />

      <div className="rounded-lg border border-light-gray bg-white p-6 shadow-md">
        <ToolConfigurationForm
          mode="create"
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
