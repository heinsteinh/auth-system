import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

/**
 * Access token lives in memory only — never localStorage. The refresh token
 * is held by the API as an HttpOnly cookie at /api/auth, so JS can't see it.
 * On a hard reload, the SPA must call /refresh to mint a new access token.
 */
let accessTokenInMemory: string | null = null;

export const tokenStore = {
  get access(): string | null {
    return accessTokenInMemory;
  },
  set(token: string | null): void {
    accessTokenInMemory = token;
  },
  clear(): void {
    accessTokenInMemory = null;
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

let refreshing: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;

  refreshing = axios
    .post<{ accessToken: string }>(`${API_URL}/api/auth/refresh`, undefined, {
      withCredentials: true,
    })
    .then(({ data }) => {
      tokenStore.set(data.accessToken);
      return data.accessToken;
    })
    .catch(() => {
      tokenStore.clear();
      return null;
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
      !original.url?.endsWith('/api/auth/login') &&
      !original.url?.endsWith('/api/auth/logout')
    ) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers.set('Authorization', `Bearer ${newToken}`);
        return api.request(original);
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
    api.post<{ accessToken: string; user: AuthUser }>('/api/auth/login', input).then((r) => r.data),

  logout: () => api.post('/api/auth/logout').then(() => undefined),

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
