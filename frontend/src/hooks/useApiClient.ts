// src/hooks/useApiClient.ts
import { useState } from "react";
import useHttp from "./useHttp";
import { ApiResponse } from "../types/api";

type Status = "idle" | "loading" | "success" | "error";

export function useApiClient() {
  const http = useHttp();

  /** Query 用フック */
  function useQuery<R extends ApiResponse<any>>(url: string | null) {
    const { data: res, error, isLoading, mutate } = http.get<R>(url);

    type SuccessData<T> = T extends { success: true; data: infer D }
      ? D
      : never;

    type Data = SuccessData<R>;
    const data: Data | null = res && res.success ? (res.data as Data) : null;

    return { data, raw: res, isLoading, error, refetch: mutate };
  }

  /** Mutation 用フック */
  function useMutation<T, P = any>(
    method: "post" | "put" | "patch" | "delete",
    url: string
  ) {
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState<Error | null>(null);

    async function mutateAsync(payload?: P, overrideUrl?: string): Promise<T> {
      setStatus("loading");
      setError(null);
      const endpoint = overrideUrl ?? url;
      try {
        let res;
        if (method === "post") {
          res = await http.post<ApiResponse<T>>(endpoint, payload);
        } else if (method === "put") {
          res = await http.put<ApiResponse<T>>(endpoint, payload);
        } else if (method === "patch") {
          res = await http.patch<ApiResponse<T>>(endpoint, payload);
        } else {
          res = await http.delete<ApiResponse<T>>(endpoint);
        }
        if (!res.data.success) {
          throw new Error(res.data.error ?? "API Error");
        }
        setStatus("success");
        return res.data.data as T;
      } catch (e) {
        const err = e instanceof Error ? e : new Error("Unknown error");
        setError(err);
        setStatus("error");
        throw err;
      }
    }

    return { mutateAsync, status, error };
  }

  return { useQuery, useMutation };
}
