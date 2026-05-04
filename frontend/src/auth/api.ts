import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

const ACCESS_TOKEN_KEY = 'auth.accessToken';
const REFRESH_TOKEN_KEY = 'auth.refreshToken';

export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access;
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshing: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshing) return refreshing;

  const refresh = tokenStore.refresh;
  if (!refresh) throw new Error('NO_REFRESH_TOKEN');

  refreshing = axios
    .post<{ accessToken: string; refreshToken: string }>(
      `${API_URL}/api/auth/refresh`,
      { refreshToken: refresh },
    )
    .then(({ data }) => {
      tokenStore.set(data.accessToken, data.refreshToken);
      return data.accessToken;
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.endsWith('/api/auth/refresh') &&
      !original.url?.endsWith('/api/auth/login')
    ) {
      original._retry = true;
      try {
        const newToken = await refreshAccessToken();
        original.headers.set('Authorization', `Bearer ${newToken}`);
        return api.request(original);
      } catch {
        tokenStore.clear();
      }
    }

    return Promise.reject(error);
  },
);

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  isEmailVerified: boolean;
};

export const authApi = {
  register: (input: { email: string; password: string; name?: string }) =>
    api.post<{ user: AuthUser }>('/api/auth/register', input).then((r) => r.data),

  login: (input: { email: string; password: string }) =>
    api
      .post<{ accessToken: string; refreshToken: string; user: AuthUser }>(
        '/api/auth/login',
        input,
      )
      .then((r) => r.data),

  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/api/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (token: string, newPassword: string) =>
    api
      .post<{ message: string }>('/api/auth/reset-password', { token, newPassword })
      .then((r) => r.data),

  me: () => api.get<AuthUser>('/api/users/me').then((r) => r.data),

  listUsers: () => api.get<AuthUser[]>('/api/users/admin/users').then((r) => r.data),

  deleteUser: (id: string) => api.delete(`/api/users/admin/users/${id}`).then(() => undefined),

  setUserRole: (id: string, role: 'USER' | 'ADMIN') =>
    api.patch<AuthUser>(`/api/users/admin/users/${id}`, { role }).then((r) => r.data),
};
