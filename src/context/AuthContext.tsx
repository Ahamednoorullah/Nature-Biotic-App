import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getAuthAdapter } from "@/lib/auth/localAuth";
import type { AuthUser, UserRole } from "@/lib/auth/types";

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
    auth
      .ensureReady()
      .then(applySession)
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
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
    return () => {
      cancelled = true;
      window.removeEventListener("popstate", onSessionChange);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onSessionChange);
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

  const signOut = () => {
    void auth.signOut();
    setUser(null);
    window.history.replaceState(null, "", "/login");
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, completePasswordSetup, signOut }}
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
