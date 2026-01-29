import * as React from "react";
import apiClient, {
  AuthUser,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/lib/api-client";

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<AuthUser>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    taxNumber?: string;
  }) => Promise<AuthUser>;
  logout: () => void;
  refreshMe: () => Promise<AuthUser | null>;
  refreshToken: () => Promise<string | null>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return getAccessToken();
  });
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refreshMe = React.useCallback(async () => {
    const t = getAccessToken();
    if (!t) {
      setUser(null);
      setToken(null);
      return null;
    }

    try {
      const me = await apiClient.getMe();
      setUser(me);
      setToken(t);
      return me;
    } catch {
      clearAccessToken();
      setUser(null);
      setToken(null);
      return null;
    }
  }, []);

  const refreshToken = React.useCallback(async () => {
    const t = getAccessToken();
    if (!t) return null;

    try {
      const resp = await apiClient.refresh();
      const newToken = resp?.access_token;
      if (!newToken) return null;

      const remember = !!localStorage.getItem("access_token") && !sessionStorage.getItem("access_token");
      setAccessToken(newToken, remember);
      setToken(newToken);
      return newToken;
    } catch {
      return null;
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refreshMe();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshMe]);

  const login = React.useCallback(
    async (email: string, password: string, rememberMe?: boolean) => {
      const res = await apiClient.login(email, password, rememberMe);
      setToken(res.access_token);
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const register = React.useCallback(
    async (input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      companyName?: string;
      companyAddress?: string;
      companyPhone?: string;
      companyEmail?: string;
      taxNumber?: string;
    }) => {
      const res = await apiClient.register(input);
      setToken(res.access_token);
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const logout = React.useCallback(() => {
    apiClient.logout();
    setUser(null);
    setToken(null);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      login,
      register,
      logout,
      refreshMe,
      refreshToken,
    }),
    [token, user, loading, login, register, logout, refreshMe, refreshToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
