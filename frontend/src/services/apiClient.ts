import axios, { AxiosError, type AxiosInstance } from 'axios';
import type { ApiError } from '@/types';

const apiClient: AxiosInstance = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// The shape errorHandler.ts actually sends: { error: { code, message } }.
// The HTTP status itself carries the status code — it's never in the body.
export interface BackendErrorBody {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
  };
}

// Normalises a raw axios rejection (backend { error: { code, message } } body,
// or no response at all for a network failure) to the flat ApiError shape
// every thunk in the app rejects with.
export const normalizeApiError = (error: AxiosError<BackendErrorBody>): ApiError => {
  const backendError = error.response?.data?.error;
  return {
    statusCode: error.response?.status ?? 0,
    code: backendError?.code ?? 'NETWORK_ERROR',
    message: backendError?.message ?? error.message,
  };
};

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<BackendErrorBody>) => Promise.reject(normalizeApiError(error)),
);

export default apiClient;
