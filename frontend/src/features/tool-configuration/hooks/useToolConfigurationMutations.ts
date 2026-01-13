import { useApiClient } from "../../../hooks/useApiClient";
import {
  CreateToolConfigurationRequest,
  ToolConfiguration,
  PreviewToolsResult,
} from "../types";

export const useCreateToolConfiguration = () => {
  const { mutateAsync, status, error } = useApiClient().useMutation<
    { success: boolean; data: ToolConfiguration },
    CreateToolConfigurationRequest
  >("post", "/tool-configurations");

  return { createToolConfiguration: mutateAsync, status, error };
};

export const useDeleteToolConfiguration = () => {
  const { mutateAsync, status, error } = useApiClient().useMutation<
    { success: boolean },
    void
  >("delete", "/tool-configurations");

  const deleteToolConfiguration = (id: string) => {
    return mutateAsync(undefined, `/tool-configurations/${id}`);
  };

  return { deleteToolConfiguration, status, error };
};

export const usePreviewMcpTools = () => {
  const { mutateAsync, status, error } = useApiClient().useMutation<
    PreviewToolsResult[],
    { mcpConfig: any }
  >("post", "/tool-configurations/preview-tools");

  return { previewMcpTools: mutateAsync, status, error };
};
