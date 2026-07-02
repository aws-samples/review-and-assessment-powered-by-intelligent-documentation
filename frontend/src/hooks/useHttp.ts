import useSWR, { SWRConfiguration, Fetcher } from "swr";
import i18n from "../i18n";
import { useAuth } from "../contexts/AuthContext";

const API_BASE =
  import.meta.env.VITE_APP_API_ENDPOINT || "http://localhost:3000";

const API_ENDPOINT = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;

// Define a response interface similar to AxiosResponse
interface FetchResponse<T = any> {
  data: T;
  status: number;
  headers: Headers;
  ok: boolean;
}

// Helper function to attach auth token to fetch requests
const getAuthHeaders = async (getIdToken: () => Promise<string | null>) => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  const token = await getIdToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
};

// Helper function to handle fetch responses
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    // 401エラーの場合は認証エラーとして処理
    if (response.status === 401) {
      throw new Error(i18n.t("auth.authRequired"));
    }

    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.message || response.statusText);
    throw Object.assign(error, {
      status: response.status,
      response,
      data: errorData,
    });
  }

  return response.json();
};

/**
 * Hooks for Http Request using fetch API
 */
const useHttp = () => {
  const { getIdToken } = useAuth();

  // Define the custom fetcher types
  const fetcher: Fetcher<any, string> = async (url: string) => {
    const headers = await getAuthHeaders(getIdToken);
    const response = await fetch(`${API_ENDPOINT}${url}`, { headers });
    return handleResponse(response);
  };

  // Fetcher with params for SWR
  const fetchWithParams: Fetcher<any, [string, Record<string, any>]> = async ([
    url,
    params,
  ]: [string, Record<string, any>]) => {
    const headers = await getAuthHeaders(getIdToken);
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const queryString = queryParams.toString();
    const fullUrl = `${API_ENDPOINT}${url}${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await fetch(fullUrl, { headers });
    return handleResponse(response);
  };

  return {
    /**
     * GET Request with SWR - Simple string URL version
     */
    get: <Data = any, Error = any>(
      url: string | null,
      config?: SWRConfiguration<Data, Error>
    ) => {
      return useSWR<Data, Error>(url, fetcher, config);
    },

    /**
     * GET Request with SWR - With parameters
     */
    getWithParams: <Data = any, Error = any>(
      url: string,
      params: Record<string, any>,
      config?: SWRConfiguration<Data, Error>
    ) => {
      return useSWR<Data, Error>([url, params], fetchWithParams, config);
    },

    getOnce: async <RES = any, DATA = any>(
      url: string,
      params?: DATA,
      errorProcess?: (err: any) => void
    ): Promise<FetchResponse<RES>> => {
      try {
        const headers = await getAuthHeaders(getIdToken);
        const queryParams = new URLSearchParams();

        if (params) {
          Object.entries(params as Record<string, any>).forEach(
            ([key, value]) => {
              if (value !== undefined && value !== null) {
                queryParams.append(key, String(value));
              }
            }
          );
        }

        const queryString = queryParams.toString();
        const fullUrl = `${API_ENDPOINT}${url}${
          queryString ? `?${queryString}` : ""
        }`;

        const response = await fetch(fullUrl, { headers });
        const data = await handleResponse<RES>(response);

        return {
          data,
          status: response.status,
          headers: response.headers,
          ok: response.ok,
        };
      } catch (err) {
        if (errorProcess) {
          errorProcess(err);
        } else {
          console.error(err);
        }
        throw err;
      }
    },

    post: async <RES = any, DATA = any>(
      url: string,
      data: DATA,
      errorProcess?: (err: any) => void
    ): Promise<FetchResponse<RES>> => {
      try {
        const headers = await getAuthHeaders(getIdToken);
        const response = await fetch(`${API_ENDPOINT}${url}`, {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        });

        const responseData = await handleResponse<RES>(response);
        return {
          data: responseData,
          status: response.status,
          headers: response.headers,
          ok: response.ok,
        };
      } catch (err) {
        if (errorProcess) {
          errorProcess(err);
        } else {
          console.error(err);
        }
        throw err;
      }
    },

    put: async <RES = any, DATA = any>(
      url: string,
      data: DATA,
      errorProcess?: (err: any) => void
    ): Promise<FetchResponse<RES>> => {
      try {
        const headers = await getAuthHeaders(getIdToken);
        const response = await fetch(`${API_ENDPOINT}${url}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(data),
        });

        const responseData = await handleResponse<RES>(response);
        return {
          data: responseData,
          status: response.status,
          headers: response.headers,
          ok: response.ok,
        };
      } catch (err) {
        if (errorProcess) {
          errorProcess(err);
        } else {
          console.error(err);
        }
        throw err;
      }
    },

    delete: async <RES = any, DATA = any>(
      url: string,
      params?: DATA,
      errorProcess?: (err: any) => void
    ): Promise<FetchResponse<RES>> => {
      try {
        const headers = await getAuthHeaders(getIdToken);
        const queryParams = new URLSearchParams();

        if (params) {
          Object.entries(params as Record<string, any>).forEach(
            ([key, value]) => {
              if (value !== undefined && value !== null) {
                queryParams.append(key, String(value));
              }
            }
          );
        }

        const queryString = queryParams.toString();
        const fullUrl = `${API_ENDPOINT}${url}${
          queryString ? `?${queryString}` : ""
        }`;

        const response = await fetch(fullUrl, {
          method: "DELETE",
          headers,
        });

        const responseData = await handleResponse<RES>(response);
        return {
          data: responseData,
          status: response.status,
          headers: response.headers,
          ok: response.ok,
        };
      } catch (err) {
        if (errorProcess) {
          errorProcess(err);
        } else {
          console.error(err);
        }
        throw err;
      }
    },

    patch: async <RES = any, DATA = any>(
      url: string,
      data: DATA,
      errorProcess?: (err: any) => void
    ): Promise<FetchResponse<RES>> => {
      try {
        const headers = await getAuthHeaders(getIdToken);
        const response = await fetch(`${API_ENDPOINT}${url}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(data),
        });

        const responseData = await handleResponse<RES>(response);
        return {
          data: responseData,
          status: response.status,
          headers: response.headers,
          ok: response.ok,
        };
      } catch (err) {
        if (errorProcess) {
          errorProcess(err);
        } else {
          console.error(err);
        }
        throw err;
      }
    },
  };
};

export default useHttp;
