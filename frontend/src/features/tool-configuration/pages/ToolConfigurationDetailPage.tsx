import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToolConfiguration } from "../hooks/useToolConfigurationQueries";
import ToolConfigurationForm from "../components/ToolConfigurationForm";
import PageHeader from "../../../components/PageHeader";
import { HiExclamationCircle } from "react-icons/hi";

export default function ToolConfigurationDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toolConfiguration, isLoading, error } = useToolConfiguration(id!);

  const handleCancel = () => {
    navigate("/tool-configurations");
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-aws-squid-ink-light"></div>
      </div>
    );
  }

  if (error || !toolConfiguration) {
    return (
      <div>
        <PageHeader
          title="Tool Configuration"
          backLink={{
            to: "/tool-configurations",
            label: "Back to Tool Configurations",
          }}
        />
        <div
          className="mb-6 rounded-md border border-red bg-light-red px-6 py-4 text-red shadow-sm"
          role="alert">
          <div className="flex items-center">
            <HiExclamationCircle className="mr-2 h-6 w-6" />
            <strong className="font-medium">Error: </strong>
            <span className="ml-2">
              {error?.message || "Tool configuration not found"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={toolConfiguration.name}
        description="Tool configuration details"
        backLink={{
          to: "/tool-configurations",
          label: "Back to Tool Configurations",
        }}
      />

      <div className="rounded-lg border border-light-gray bg-white p-6 shadow-md">
        <ToolConfigurationForm
          mode="view"
          initialData={toolConfiguration}
          onSubmit={async () => {}}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
