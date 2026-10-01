import { attachAccountLink } from "@/lib/data";
import { getPasswordResetMailer } from "@/lib/auth/passwordResetMailer";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { roleLabel } from "@/lib/auth/roles";
import type {
  AuthAccount,
  AuthAdapter,
  AuthUser,
  CreateAccountInput,
  PasswordResetRequestResult,
  SignInResult,
  UpdateAccountInput,
  UserRole,
} from "@/lib/auth/types";

const ACCOUNT_KEY = "nature-biotic-auth-accounts-v1";
const CREDENTIAL_KEY = "nature-biotic-auth-credentials-v1";
const SESSION_KEY = "nature-biotic-auth-session-v1";
const RESET_KEY = "nature-biotic-auth-password-resets-v1";
const RESET_TTL_MS = 30 * 60 * 1000;

type CredentialRecord = {
  accountId: string;
  salt: string;
  hash: string;
};

type PasswordResetRecord = {
  accountId: string;
  tokenHash: string;
  expiresAt: number;
};

type SeedAccount = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  subjectType: AuthAccount["subjectType"];
  subjectId: string;
  storeId?: string;
  staffId?: string;
};

const SEEDED_ACCOUNTS: SeedAccount[] = [
  {
    id: "user-admin-1",
    email: "admin@naturebiotic.com",
    password: "demo1234",
    name: "Administrator",
    role: "company_admin",
    subjectType: "company",
    subjectId: "company",
  },
  {
    id: "user-store-sairam",
    email: "sairam@naturebiotic.com",
    password: "store1234",
    name: "Sairam Store Admin",
    role: "store_admin",
    subjectType: "store",
    subjectId: "s1",
    storeId: "s1",
  },
  {
    id: "staff-st0",
    email: "ram.kumar@naturebiotic.in",
    password: "fro1234",
    name: "Ram Kumar",
    role: "fro",
    subjectType: "staff",
    subjectId: "st0",
    storeId: "s1",
    staffId: "st0",
  },
  {
    id: "staff-st1",
    email: "ajith.kumar@naturebiotic.in",
    password: "fro1234",
    name: "Ajith Kumar",
    role: "fro",
    subjectType: "staff",
    subjectId: "st1",
    storeId: "s2",
    staffId: "st1",
  },
  {
    id: "staff-st2",
    email: "periyasamy@naturebiotic.in",
    password: "fro1234",
    name: "PeriyaSamy",
    role: "fro",
    subjectType: "staff",
    subjectId: "st2",
    storeId: "s3",
    staffId: "st2",
  },
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readAccounts() {
  return readJson<AuthAccount[]>(ACCOUNT_KEY, []);
}

function writeAccounts(rows: AuthAccount[]) {
  writeJson(ACCOUNT_KEY, rows);
}

function readCredentials() {
  return readJson<CredentialRecord[]>(CREDENTIAL_KEY, []);
}

function writeCredentials(rows: CredentialRecord[]) {
  writeJson(CREDENTIAL_KEY, rows);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toUser(account: AuthAccount): AuthUser {
  return {
    id: account.id,
    staffId: account.staffId,
    name: account.name,
    email: account.email,
    role: account.role,
    roleLabel: account.roleLabel,
    storeId: account.storeId,
    externalAuthId: account.externalAuthId,
  };
}

function readStoredSession(): AuthUser | null {
  const local = readJson<AuthUser | null>(SESSION_KEY, null);
  if (local?.id) return local;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function readSession(): AuthUser | null {
  const stored = readStoredSession();
  if (!stored?.id || !stored.role) return null;

  const account = readAccounts().find(
    (row) => row.id === stored.id && row.status === "active",
  );
  if (!account || account.role !== stored.role) {
    clearSession();
    return null;
  }

  return toUser(account);
}

function writeSession(user: AuthUser, remember: boolean) {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  if (remember) writeJson(SESSION_KEY, user);
  else sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

let ready: Promise<void> | null = null;

async function ensureReady() {
  if (!ready) ready = seedAccounts();
  await ready;
}

async function seedAccounts() {
  const accounts = readAccounts();
  const credentials = readCredentials();
  let accountsChanged = false;
  let credentialsChanged = false;

  for (const seed of SEEDED_ACCOUNTS) {
    const email = normalizeEmail(seed.email);
    let account = accounts.find(
      (row) => row.id === seed.id || normalizeEmail(row.email) === email,
    );
    if (!account) {
      account = {
        id: seed.id,
        email,
        name: seed.name,
        role: seed.role,
        roleLabel: roleLabel(seed.role),
        subjectType: seed.subjectType,
        subjectId: seed.subjectId,
        storeId: seed.storeId,
        staffId: seed.staffId,
        passwordSet: true,
        status: "active",
        externalAuthId: null,
      };
      accounts.push(account);
      accountsChanged = true;
    }
    if (!credentials.some((row) => row.accountId === account!.id)) {
      const hashed = await hashPassword(seed.password);
      credentials.push({ accountId: account.id, ...hashed });
      credentialsChanged = true;
    }
    if (seed.subjectType === "store" || seed.subjectType === "staff") {
      attachAccountLink(seed.subjectType, seed.subjectId, account.id);
    }
  }

  if (accountsChanged) writeAccounts(accounts);
  if (credentialsChanged) writeCredentials(credentials);
}

function findActiveByEmail(email: string) {
  const normalized = normalizeEmail(email);
  return readAccounts().find(
    (account) =>
      account.status === "active" && normalizeEmail(account.email) === normalized,
  );
}

async function signIn(
  email: string,
  password: string,
  remember = true,
): Promise<SignInResult> {
  await ensureReady();
  const account = findActiveByEmail(email);
  if (!account) return { user: null, error: "Invalid email or password." };
  if (!account.passwordSet) {
    return { user: null, error: null, needsPasswordSetup: true };
  }
  const credential = readCredentials().find((row) => row.accountId === account.id);
  if (!credential || !(await verifyPassword(password, credential.salt, credential.hash))) {
    return { user: null, error: "Invalid email or password." };
  }
  const user = toUser(account);
  writeSession(user, remember);
  return { user, error: null };
}

async function completePasswordSetup(
  email: string,
  password: string,
  remember = true,
): Promise<SignInResult> {
  await ensureReady();
  const account = findActiveByEmail(email);
  if (!account) return { user: null, error: "Account not found." };
  if (account.passwordSet) {
    return signIn(email, password, remember);
  }
  if (password.length < 8) {
    return { user: null, error: "Password must be at least 8 characters." };
  }
  const hashed = await hashPassword(password);
  const credentials = readCredentials().filter((row) => row.accountId !== account.id);
  credentials.push({ accountId: account.id, ...hashed });
  writeCredentials(credentials);
  const accounts = readAccounts().map((row) =>
    row.id === account.id ? { ...row, passwordSet: true } : row,
  );
  writeAccounts(accounts);
  const user = toUser({ ...account, passwordSet: true });
  writeSession(user, remember);
  return { user, error: null };
}

async function createAccount(input: CreateAccountInput) {
  await ensureReady();
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return { account: null, error: "Enter a valid email address." };
  }
  if (findActiveByEmail(email)) {
    return { account: null, error: "An account with this email already exists." };
  }
  const account: AuthAccount = {
    id: `acct-${crypto.randomUUID()}`,
    email,
    name: input.name.trim(),
    role: input.role,
    roleLabel: roleLabel(input.role),
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    storeId: input.storeId,
    staffId: input.staffId,
    passwordSet: false,
    status: "active",
    externalAuthId: null,
  };
  writeAccounts([...readAccounts(), account]);
  if (input.subjectType === "store" || input.subjectType === "staff") {
    attachAccountLink(input.subjectType, input.subjectId, account.id);
  }
  return { account, error: null };
}

async function updateAccount(input: UpdateAccountInput) {
  await ensureReady();
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return { account: null, error: "Enter a valid email address." };
  }
  const accounts = readAccounts();
  const current = accounts.find((row) => row.id === input.accountId);
  if (!current || current.status !== "active") {
    return { account: null, error: "Account not found." };
  }
  const duplicate = accounts.find(
    (row) =>
      row.id !== current.id &&
      row.status === "active" &&
      normalizeEmail(row.email) === email,
  );
  if (duplicate) {
    return { account: null, error: "An account with this email already exists." };
  }
  const next: AuthAccount = {
    ...current,
    email,
    name: input.name.trim(),
    role: input.role,
    roleLabel: roleLabel(input.role),
    storeId: input.storeId,
    staffId: input.staffId,
  };
  writeAccounts(accounts.map((row) => (row.id === next.id ? next : row)));
  return { account: next, error: null };
}

function readResets() {
  return readJson<PasswordResetRecord[]>(RESET_KEY, []).filter(
    (row) => row.expiresAt > Date.now(),
  );
}

function writeResets(rows: PasswordResetRecord[]) {
  writeJson(
    RESET_KEY,
    rows.filter((row) => row.expiresAt > Date.now()),
  );
}

async function hashResetToken(token: string) {
  const bits = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  let binary = "";
  new Uint8Array(bits).forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

async function requestPasswordReset(
  email: string,
): Promise<PasswordResetRequestResult> {
  await ensureReady();
  if (!isValidEmail(email)) return { status: "invalid_email" };
  const account = findActiveByEmail(email);
  if (!account || !account.passwordSet) return { status: "not_found" };

  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const tokenHash = await hashResetToken(token);
  writeResets([
    ...readResets().filter((row) => row.accountId !== account.id),
    { accountId: account.id, tokenHash, expiresAt: Date.now() + RESET_TTL_MS },
  ]);

  const mailer = getPasswordResetMailer();
  if (!mailer) return { status: "email_not_configured", token };

  const resetUrl = `${window.location.origin}/login?reset=${encodeURIComponent(token)}`;
  try {
    await mailer.sendResetLink({ to: account.email, resetUrl });
  } catch {
    writeResets(readResets().filter((row) => row.accountId !== account.id));
    return { status: "send_failed" };
  }
  return { status: "sent" };
}

async function completePasswordReset(token: string, password: string) {
  await ensureReady();
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  const tokenHash = await hashResetToken(token);
  const reset = readResets().find((row) => row.tokenHash === tokenHash);
  if (!reset) return { error: "This reset link is invalid or has expired." };

  const account = readAccounts().find(
    (row) => row.id === reset.accountId && row.status === "active",
  );
  if (!account) return { error: "This reset link is invalid or has expired." };

  const hashed = await hashPassword(password);
  writeCredentials([
    ...readCredentials().filter((row) => row.accountId !== account.id),
    { accountId: account.id, ...hashed },
  ]);
  writeAccounts(
    readAccounts().map((row) =>
      row.id === account.id ? { ...row, passwordSet: true } : row,
    ),
  );
  writeResets(readResets().filter((row) => row.accountId !== account.id));
  return { error: null };
}

async function disableAccount(accountId: string) {
  await ensureReady();
  writeAccounts(
    readAccounts().map((row) =>
      row.id === accountId ? { ...row, status: "disabled" as const } : row,
    ),
  );
  const session = readSession();
  if (session?.id === accountId) clearSession();
}

export const localAuth: AuthAdapter = {
  ensureReady,
  getSession() {
    return readSession();
  },
  signIn,
  completePasswordSetup,
  requestPasswordReset,
  completePasswordReset,
  async signOut() {
    clearSession();
  },
  createAccount,
  updateAccount,
  disableAccount,
};

export function getAuthAdapter(): AuthAdapter {
  return localAuth;
}

export async function changeAccountPassword(
  accountId: string,
  currentPassword: string,
  nextPassword: string,
) {
  await ensureReady();
  const account = readAccounts().find(
    (row) => row.id === accountId && row.status === "active",
  );
  if (!account) return { error: "Account not found." };
  const credential = readCredentials().find((row) => row.accountId === account.id);
  if (
    !credential ||
    !(await verifyPassword(currentPassword, credential.salt, credential.hash))
  ) {
    return { error: "Current password is incorrect." };
  }
  if (nextPassword.trim().length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  const hashed = await hashPassword(nextPassword);
  writeCredentials([
    ...readCredentials().filter((row) => row.accountId !== account.id),
    { accountId: account.id, ...hashed },
  ]);
  return { error: null };
}
