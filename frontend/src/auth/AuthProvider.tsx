import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, refreshAccessToken, tokenStore, type AuthUser } from './api';
import { AuthContext, type AuthState } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshMe = useCallback(async () => {
    if (!tokenStore.access) {
      setUser(null);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await refreshAccessToken();
      if (!cancelled && token) {
        await refreshMe();
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  const login = useCallback<AuthState['login']>(async (email, password) => {
    const result = await authApi.login({ email, password });
    tokenStore.set(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback<AuthState['register']>(async (input) => {
    await authApi.register(input);
  }, []);

  const logout = useCallback<AuthState['logout']>(async () => {
    try {
      await authApi.logout();
    } catch {
      // logout is idempotent server-side; clear local state regardless
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshMe }),
    [user, loading, login, register, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
