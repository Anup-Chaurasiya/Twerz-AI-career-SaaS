import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { APIError } from '@/types';

const client = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: Error | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
};

client.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<APIError>) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (
      error.response?.status === 401 &&
      error.response?.data?.detail === 'token_expired' &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => client(originalRequest))
          .catch((err) => Promise.reject(err));
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const response = await client.post('/auth/refresh');
        const { access_token } = response.data;
        localStorage.setItem('token', access_token);
        processQueue();
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error);
        localStorage.removeItem('token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default client;

export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<APIError>;
    return axiosError.response?.data?.detail || axiosError.message || 'An error occurred';
  }
  if (error instanceof Error) return error.message;
  return 'An unknown error occurred';
};

export const isCredit429Error = (error: unknown): boolean => {
  if (axios.isAxiosError(error)) return error.response?.status === 429;
  return false;
};
