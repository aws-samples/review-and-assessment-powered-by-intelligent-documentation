import { useApiClient } from "../../../hooks/useApiClient";
import { ApiResponse } from "../../../types/api";
import { ToolConfiguration } from "../types";

export const useToolConfigurations = () => {
  const { data, isLoading, error, refetch } = useApiClient().useQuery<
    ApiResponse<ToolConfiguration[]>
  >("/tool-configurations");

  console.log("[useToolConfigurations] Raw response:", {
    data,
    isLoading,
    error,
  });

  return {
    toolConfigurations: data || [],
    isLoading,
    error,
    refetch,
  };
};

export const useToolConfiguration = (id: string) => {
  const { data, isLoading, error, refetch } = useApiClient().useQuery<
    ApiResponse<ToolConfiguration>
  >(`/tool-configurations/${id}`);

  console.log("[useToolConfiguration] Raw response:", {
    data,
    isLoading,
    error,
    id,
  });

  return {
    toolConfiguration: data,
    isLoading,
    error,
    refetch,
  };
};
