import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, tokenStore, type AuthUser } from './api';

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

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
      await refreshMe();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  const login = useCallback<AuthState['login']>(async (email, password) => {
    const result = await authApi.login({ email, password });
    tokenStore.set(result.accessToken, result.refreshToken);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback<AuthState['register']>(async (input) => {
    await authApi.register(input);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshMe }),
    [user, loading, login, register, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
