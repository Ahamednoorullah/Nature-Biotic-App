export type UserRole = "company_admin" | "store_admin" | "fro";

export type AuthSubjectType = "company" | "store" | "staff";

/**
 * Signed-in user. `id` is the temporary account id.
 * When Supabase Auth is connected, `externalAuthId` holds the Supabase user id.
 * Business screens should keep using `storeId` and `staffId`.
 */
export type AuthUser = {
  id: string;
  staffId?: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  storeId?: string;
  externalAuthId?: string | null;
};

export type AuthAccount = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  subjectType: AuthSubjectType;
  subjectId: string;
  storeId?: string;
  staffId?: string;
  passwordSet: boolean;
  status: "active" | "disabled";
  externalAuthId: string | null;
};

export type CreateAccountInput = {
  name: string;
  email: string;
  role: UserRole;
  subjectType: AuthSubjectType;
  subjectId: string;
  storeId?: string;
  staffId?: string;
};

export type UpdateAccountInput = {
  accountId: string;
  name: string;
  email: string;
  role: UserRole;
  storeId?: string;
  staffId?: string;
};

export type SignInResult = {
  user: AuthUser | null;
  error: string | null;
  needsPasswordSetup?: boolean;
};

export type PasswordResetRequestResult =
  | { status: "invalid_email" }
  | { status: "not_found" }
  | { status: "sent" }
  | { status: "email_not_configured"; token: string }
  | { status: "send_failed" };

/**
 * Replace `localAuth` with a Supabase adapter that implements this interface.
 * Store and staff screens should call these methods, not a vendor SDK.
 */
export interface AuthAdapter {
  ensureReady(): Promise<void>;
  getSession(): AuthUser | null;
  signIn(
    email: string,
    password: string,
    remember?: boolean,
  ): Promise<SignInResult>;
  completePasswordSetup(
    email: string,
    password: string,
    remember?: boolean,
  ): Promise<SignInResult>;
  requestPasswordReset(email: string): Promise<PasswordResetRequestResult>;
  completePasswordReset(
    token: string,
    password: string,
  ): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
  createAccount(
    input: CreateAccountInput,
  ): Promise<{ account: AuthAccount | null; error: string | null }>;
  updateAccount(
    input: UpdateAccountInput,
  ): Promise<{ account: AuthAccount | null; error: string | null }>;
  disableAccount(accountId: string): Promise<void>;
}
