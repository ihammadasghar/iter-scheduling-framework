import axios, { AxiosError, type AxiosInstance } from 'axios';
import type { ApiError } from '@/types';

const apiClient: AxiosInstance = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    // Normalise every error response to the ApiError shape and rethrow
    const apiError: ApiError = error.response?.data ?? {
      statusCode: error.response?.status ?? 0,
      code: 'NETWORK_ERROR',
      message: error.message,
    };
    return Promise.reject(apiError);
  },
);

export default apiClient;
