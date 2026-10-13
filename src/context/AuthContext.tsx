import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getAuthAdapter } from "@/lib/auth/localAuth";
import { AUTH_SESSION_EVENT } from "@/lib/auth/events";
import type {
  AuthUser,
  PasswordResetRequestResult,
  UserRole,
} from "@/lib/auth/types";

export type { AuthUser, UserRole };

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
    remember?: boolean,
  ) => Promise<{ error: string | null; needsPasswordSetup?: boolean }>;
  completePasswordSetup: (
    email: string,
    password: string,
    remember?: boolean,
  ) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<PasswordResetRequestResult>;
  completePasswordReset: (
    token: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuthAdapter();

  useEffect(() => {
    let cancelled = false;
    const applySession = () => {
      if (cancelled) return;
      setUser(auth.getSession());
    };
    const readyTimeout = window.setTimeout(() => {
      if (cancelled) return;
      setUser(auth.getSession());
      setLoading(false);
    }, 8000);

    auth
      .ensureReady()
      .then(applySession)
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        window.clearTimeout(readyTimeout);
        if (!cancelled) setLoading(false);
      });

    const onSessionChange = () => {
      if (!cancelled) setUser(auth.getSession());
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) onSessionChange();
    };
    window.addEventListener("popstate", onSessionChange);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onSessionChange);
    window.addEventListener(AUTH_SESSION_EVENT, onSessionChange);
    return () => {
      cancelled = true;
      window.clearTimeout(readyTimeout);
      window.removeEventListener("popstate", onSessionChange);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onSessionChange);
      window.removeEventListener(AUTH_SESSION_EVENT, onSessionChange);
    };
  }, [auth]);

  const signIn = async (
    email: string,
    password: string,
    remember = true,
  ) => {
    const result = await auth.signIn(email, password, remember);
    if (result.user) setUser(result.user);
    return {
      error: result.error,
      needsPasswordSetup: result.needsPasswordSetup,
    };
  };

  const completePasswordSetup = async (
    email: string,
    password: string,
    remember = true,
  ) => {
    const result = await auth.completePasswordSetup(email, password, remember);
    if (result.user) setUser(result.user);
    return { error: result.error };
  };

  const requestPasswordReset = (email: string) =>
    auth.requestPasswordReset(email);

  const completePasswordReset = (token: string, password: string) =>
    auth.completePasswordReset(token, password);

  const signOut = () => {
    void auth.signOut();
    setUser(null);
    window.history.replaceState(null, "", "/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        completePasswordSetup,
        requestPasswordReset,
        completePasswordReset,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return ctx;
}
