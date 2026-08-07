import { createContext, useContext, useState, type ReactNode } from 'react';

type MockUser = {
  name: string;
  email: string;
  role: string;
};

type AuthContextValue = {
  user: MockUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_USER: MockUser = {
  name: 'Administrator',
  email: 'admin@naturebiotic.com',
  role: 'Company Administrator',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);
  const [loading] = useState(false);

  const signIn = async (email: string, _password: string) => {
    await new Promise((r) => setTimeout(r, 600));
    setUser({ ...DEMO_USER, email: email || DEMO_USER.email });
    return { error: null };
  };

  const signOut = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
