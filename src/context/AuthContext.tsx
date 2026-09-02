import { createContext, useContext, useState, type ReactNode } from "react";

export type UserRole = "company_admin" | "store_admin";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  storeId?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_USERS: Array<AuthUser & { password: string }> = [
  {
    id: "user-admin-1",
    name: "Administrator",
    email: "admin@naturebiotic.com",
    password: "demo1234",
    role: "company_admin",
    roleLabel: "Company Administrator",
  },
  {
    id: "user-store-sairam",
    name: "Sairam Store Admin",
    email: "sairam@naturebiotic.com",
    password: "store1234",
    role: "store_admin",
    roleLabel: "Store Administrator",
    storeId: "s1",
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  // Always start without a logged-in user so the Login page is shown first.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading] = useState(false);

  const signIn = async (email: string, password: string) => {
    await new Promise((resolve) => setTimeout(resolve, 450));

    const normalizedEmail = email.trim().toLowerCase();

    const matchedUser = DEMO_USERS.find(
      (item) =>
        item.email.toLowerCase() === normalizedEmail &&
        item.password === password,
    );

    if (!matchedUser) {
      return { error: "Invalid email or password." };
    }

    const { password: _password, ...safeUser } = matchedUser;
    setUser(safeUser);

    return { error: null };
  };

  const signOut = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
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
