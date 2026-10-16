import {
  authUrlCallback,
  clearPasswordSetupRequired,
  getSupabase,
  isSupabaseConfigured,
  passwordSetupRequired,
  setAuthRememberMe,
} from "@/lib/supabase";
import { emitAuthRecovery, emitAuthSession } from "@/lib/auth/events";
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

const INVALID_CREDENTIALS = "Invalid email or password.";
const ACCOUNT_DISABLED =
  "This account is disabled. Contact the company administrator.";
const STORE_NOT_LINKED = "This store login is not linked to a store.";
const STORE_INACTIVE = "This store is not active.";
const FRO_NOT_ENABLED = "Field officer sign-in is not enabled yet.";
const ACCOUNT_NOT_LINKED = "This account is not linked to Nature Biotic.";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  store_id: string | null;
  staff_id: string | null;
};

let cachedUser: AuthUser | null = null;
let recoveryPending =
  authUrlCallback?.kind === "invite" ||
  authUrlCallback?.kind === "recovery" ||
  passwordSetupRequired();
let listenerBound = false;
let ready: Promise<void> | null = null;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isUserRole(value: string): value is UserRole {
  return value === "company_admin" || value === "store_admin" || value === "fro";
}

function toUser(profile: ProfileRow): AuthUser {
  const role = profile.role as UserRole;
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    role,
    roleLabel: roleLabel(role),
    storeId:
      (role === "store_admin" || role === "fro") && profile.store_id
        ? profile.store_id
        : undefined,
    staffId: profile.staff_id || undefined,
    externalAuthId: profile.id,
  };
}

function accountFromProfile(profile: ProfileRow): AuthAccount {
  const role = profile.role as UserRole;
  return {
    id: profile.id,
    email: profile.email,
    name: profile.full_name,
    role,
    roleLabel: roleLabel(role),
    subjectType: role === "store_admin" ? "store" : role === "fro" ? "staff" : "company",
    subjectId: profile.store_id || profile.id,
    storeId: profile.store_id || undefined,
    staffId: profile.staff_id || undefined,
    passwordSet: true,
    status: profile.status === "disabled" ? "disabled" : "active",
    externalAuthId: profile.id,
  };
}

function isReachabilityError(message: string) {
  return /fetch|network|abort|timeout|failed to fetch|load failed/i.test(message);
}

async function readProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("id, email, full_name, role, status, store_id, staff_id")
    .eq("id", userId)
    .maybeSingle();
  if (error && isReachabilityError(error.message || "")) {
    throw new Error("Could not reach Supabase. The local API is not reachable.");
  }
  if (error || !data) return null;
  return data as ProfileRow;
}

async function signOutLater() {
  window.setTimeout(() => {
    void getSupabase().auth.signOut();
  }, 0);
}

async function rejectSession(error: string): Promise<SignInResult> {
  cachedUser = null;
  signOutLater();
  return { user: null, error };
}

async function resolveUser(userId: string): Promise<SignInResult> {
  const profile = await readProfile(userId);
  if (!profile) return rejectSession(ACCOUNT_NOT_LINKED);
  if (profile.status !== "active") return rejectSession(ACCOUNT_DISABLED);
  if (!isUserRole(profile.role)) return rejectSession(ACCOUNT_NOT_LINKED);
  if (profile.role === "company_admin") {
    cachedUser = toUser(profile);
    return { user: cachedUser, error: null };
  }
  if (!profile.store_id) return rejectSession(STORE_NOT_LINKED);
  const storeResult = await getSupabase()
    .from("stores")
    .select("id, status")
    .eq("id", profile.store_id)
    .maybeSingle();
  if (storeResult.error || !storeResult.data) return rejectSession(STORE_NOT_LINKED);
  if (storeResult.data.status !== "active") return rejectSession(STORE_INACTIVE);
  cachedUser = toUser(profile);
  return { user: cachedUser, error: null };
}

async function readInvokeError(error: unknown) {
  const details = await readInvokeDetails(error);
  return details.error;
}

async function readInvokeDetails(error: unknown) {
  const fallback = "The store login could not be created.";
  if (!error || typeof error !== "object") {
    return { error: fallback, canReassign: false, canResend: false };
  }
  const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (body && typeof body === "object") {
        const canReassign =
          "can_reassign" in body && body.can_reassign === true;
        const canResend = "can_resend" in body && body.can_resend === true;
        if (
          "error" in body &&
          typeof body.error === "string" &&
          body.error.trim()
        ) {
          return { error: body.error, canReassign, canResend };
        }
        if (
          "message" in body &&
          typeof body.message === "string" &&
          body.message.trim()
        ) {
          return { error: body.message, canReassign, canResend };
        }
      }
    } catch {
      // The function returned a non-JSON error. Use the client message below.
    }
  }
  const message = (error as { message?: string }).message || "";
  if (/failed to fetch|failed to send a request|relay error|404|not found/i.test(message)) {
    return {
      error: "Store login provisioning is not available. Start the local Supabase functions runtime and try again.",
      canReassign: false,
      canResend: false,
    };
  }
  return { error: message || fallback, canReassign: false, canResend: false };
}

async function applySessionUser(userId: string | undefined) {
  if (!userId || recoveryPending) {
    cachedUser = null;
    emitAuthSession();
    return;
  }
  const result = await resolveUser(userId);
  if (result.error) cachedUser = null;
  emitAuthSession();
}

function bindAuthListener() {
  if (listenerBound || !isSupabaseConfigured()) return;
  listenerBound = true;
  getSupabase().auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      recoveryPending = true;
      cachedUser = null;
      emitAuthRecovery();
      emitAuthSession();
      return;
    }
    if (recoveryPending && event !== "USER_UPDATED" && event !== "SIGNED_OUT") {
      return;
    }
    if (!session?.user) {
      recoveryPending = false;
      cachedUser = null;
      emitAuthSession();
      return;
    }
    if (recoveryPending && event === "USER_UPDATED") {
      recoveryPending = false;
    }
    if (recoveryPending) {
      cachedUser = null;
      emitAuthSession();
      return;
    }
    void applySessionUser(session.user.id);
  });
}

const READY_TIMEOUT_MS = 5000;

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function readExistingSession() {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user?.id;
}

async function hydrateSession() {
  if (!isSupabaseConfigured()) return;
  try {
    const userId = await readExistingSession();
    if (!userId || recoveryPending) {
      cachedUser = null;
      return;
    }
    const result = await resolveUser(userId);
    if (result.error) cachedUser = null;
  } catch {
    cachedUser = null;
  } finally {
    bindAuthListener();
    emitAuthSession();
  }
}

async function ensureReady() {
  if (!ready) {
    ready = (async () => {
      if (!isSupabaseConfigured()) return;
      await Promise.race([hydrateSession(), wait(READY_TIMEOUT_MS)]);
      bindAuthListener();
    })();
  }
  await ready;
}

async function signIn(
  email: string,
  password: string,
  remember = true,
): Promise<SignInResult> {
  await ensureReady();
  if (!isSupabaseConfigured()) {
    return { user: null, error: INVALID_CREDENTIALS };
  }
  setAuthRememberMe(remember);
  let data: { user: { id: string } | null } = { user: null };
  let error: { name?: string; status?: number; code?: string; message?: string } | null =
    null;
  try {
    const response = await getSupabase().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    data = response.data;
    error = response.error;
  } catch (caught) {
    console.error("Sign-in failed.", caught);
    return {
      user: null,
      error: "Could not reach Supabase. The local API is not reachable.",
    };
  }
  if (error || !data.user) {
    cachedUser = null;
    console.error("Sign-in failed.", {
      name: error?.name,
      status: error?.status,
      code: error?.code,
      message: error?.message,
    });
    const unreachable =
      !error ||
      error.name === "AuthRetryableFetchError" ||
      error.name === "AbortError" ||
      error.name === "TimeoutError" ||
      /fetch|network|failed to fetch|load failed|abort|timeout/i.test(error.message || "");
    return {
      user: null,
      error: unreachable
        ? "Could not reach Supabase. The local API is not reachable."
        : INVALID_CREDENTIALS,
    };
  }
  try {
    const result = await resolveUser(data.user.id);
    emitAuthSession();
    return result;
  } catch (caught) {
    cachedUser = null;
    console.error("Sign-in failed.", caught);
    return {
      user: null,
      error: "Could not reach Supabase. The local API is not reachable.",
    };
  }
}

async function completePasswordSetup(
  _email: string,
  password: string,
  remember = true,
): Promise<SignInResult> {
  await ensureReady();
  if (password.length < 8) {
    return { user: null, error: "Password must be at least 8 characters." };
  }
  setAuthRememberMe(remember);
  const { data: sessionData } = await getSupabase().auth.getSession();
  if (!sessionData.session?.user) {
    return {
      user: null,
      error: "Open the link from your email to set a password.",
    };
  }
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) {
    return { user: null, error: error.message || "Could not set the password." };
  }
  clearPasswordSetupRequired();
  recoveryPending = false;
  const result = await resolveUser(sessionData.session.user.id);
  emitAuthSession();
  return result;
}

async function requestPasswordReset(
  email: string,
): Promise<PasswordResetRequestResult> {
  await ensureReady();
  if (!isValidEmail(email)) return { status: "invalid_email" };
  if (!isSupabaseConfigured()) return { status: "send_failed" };
  const redirectTo = `${window.location.origin}/login`;
  const { error } = await getSupabase().auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo },
  );
  if (error) return { status: "send_failed" };
  return { status: "sent" };
}

async function completePasswordReset(password: string) {
  await ensureReady();
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  const { data: sessionData } = await getSupabase().auth.getSession();
  if (!sessionData.session?.user) {
    return { error: "This reset link is invalid or has expired." };
  }
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) {
    return { error: error.message || "This reset link is invalid or has expired." };
  }
  clearPasswordSetupRequired();
  recoveryPending = false;
  await getSupabase().auth.signOut();
  cachedUser = null;
  emitAuthSession();
  return { error: null };
}

async function changePassword(
  _accountId: string,
  currentPassword: string,
  nextPassword: string,
) {
  await ensureReady();
  if (nextPassword.trim().length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  const current = cachedUser;
  if (!current?.email) return { error: "Account not found." };
  const { error: verifyError } = await getSupabase().auth.signInWithPassword({
    email: current.email,
    password: currentPassword,
  });
  if (verifyError) return { error: "Current password is incorrect." };
  const { error } = await getSupabase().auth.updateUser({
    password: nextPassword,
  });
  if (error) return { error: error.message || "Could not update the password." };
  return { error: null };
}

export const supabaseAuth: AuthAdapter = {
  ensureReady,
  getSession() {
    return cachedUser;
  },
  signIn,
  completePasswordSetup,
  requestPasswordReset,
  async completePasswordReset(_token: string, password: string) {
    return completePasswordReset(password);
  },
  async signOut() {
    clearPasswordSetupRequired();
    recoveryPending = false;
    cachedUser = null;
    if (isSupabaseConfigured()) {
      await getSupabase().auth.signOut();
    }
    emitAuthSession();
  },
  async createAccount(input: CreateAccountInput) {
    await ensureReady();
    const storeId = input.storeId || input.subjectId;
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    if (input.role === "fro" || input.subjectType === "staff") {
      if (input.role !== "fro") {
        return {
          account: null,
          error: "Only a Field Representative receives a staff login.",
        };
      }
      const staffId = input.staffId || "";
      if (!staffId) {
        return { account: null, error: "Save the staff member before creating a login." };
      }
      if (!isValidEmail(email)) {
        return { account: null, error: "Enter a valid email address." };
      }
      if (!name) {
        return { account: null, error: "Enter the staff member's name." };
      }
      if (!isSupabaseConfigured()) {
        return { account: null, error: "Supabase is not configured." };
      }
      const { data, error } = await getSupabase().functions.invoke(
        "provision-store-admin",
        {
          body: {
            email,
            full_name: name,
            staff_id: staffId,
            store_id: storeId || undefined,
            redirect_to: `${window.location.origin}/login`,
            resend: input.resend === true,
          },
        },
      );
      if (error) {
        const details = await readInvokeDetails(error);
        return {
          account: null,
          error: details.error,
          canResend: details.canResend,
        };
      }
      const created = data as {
        id?: string;
        email?: string;
        full_name?: string;
        store_id?: string;
        staff_id?: string;
        error?: string;
        existing_account_linked?: boolean;
        password_setup_resent?: boolean;
      } | null;
      if (!created?.id || created.error) {
        return {
          account: null,
          error: created?.error || "The FRO login could not be created.",
        };
      }
      const passwordSetupResent = created.password_setup_resent === true;
      const linkedExisting =
        !passwordSetupResent && created.existing_account_linked === true;
      return {
        account: {
          id: created.id,
          email: created.email || email,
          name: created.full_name || name,
          role: "fro",
          roleLabel: roleLabel("fro"),
          subjectType: "staff",
          subjectId: created.staff_id || staffId,
          storeId: created.store_id || storeId,
          staffId: created.staff_id || staffId,
          passwordSet: linkedExisting,
          status: "active",
          externalAuthId: created.id,
        },
        error: null,
        linkedExisting,
        passwordSetupResent,
      };
    }
    if (input.role !== "store_admin" || input.subjectType !== "store") {
      return {
        account: null,
        error: "Only a store administrator login can be created from this screen.",
      };
    }
    if (!isValidEmail(email)) {
      return { account: null, error: "Enter a valid email address." };
    }
    if (!name) {
      return { account: null, error: "Enter the store administrator's name." };
    }
    if (!storeId) {
      return { account: null, error: "Choose a saved store before creating a login." };
    }
    if (!isSupabaseConfigured()) {
      return { account: null, error: "Supabase is not configured." };
    }
    const { data, error } = await getSupabase().functions.invoke(
      "provision-store-admin",
      {
        body: {
          email,
          full_name: name,
          store_id: storeId,
          redirect_to: `${window.location.origin}/login`,
          reassign: input.reassign === true,
          resend: input.resend === true,
        },
      },
    );
    if (error) {
      const details = await readInvokeDetails(error);
      return {
        account: null,
        error: details.error,
        canReassign: details.canReassign,
        canResend: details.canResend,
      };
    }
    const created = data as {
      id?: string;
      email?: string;
      full_name?: string;
      store_id?: string;
      error?: string;
      existing_account_linked?: boolean;
      reassigned?: boolean;
      password_setup_resent?: boolean;
    } | null;
    if (!created?.id || created.error) {
      return {
        account: null,
        error: created?.error || "The store login could not be created.",
      };
    }
    const passwordSetupResent = created.password_setup_resent === true;
    const linkedExisting =
      !passwordSetupResent &&
      (created.existing_account_linked === true || created.reassigned === true);
    const account: AuthAccount = {
      id: created.id,
      email: created.email || email,
      name: created.full_name || name,
      role: "store_admin",
      roleLabel: roleLabel("store_admin"),
      subjectType: "store",
      subjectId: created.store_id || storeId,
      storeId: created.store_id || storeId,
      passwordSet: linkedExisting,
      status: "active",
      externalAuthId: created.id,
    };
    return {
      account,
      error: null,
      linkedExisting,
      reassigned: created.reassigned === true,
      passwordSetupResent,
    };
  },
  async updateAccount(_input: UpdateAccountInput) {
    return {
      account: null,
      error: "Account changes are not saved from this screen yet.",
    };
  },
  async disableAccount(accountId: string) {
    await ensureReady();
    if (!isSupabaseConfigured()) return;
    await getSupabase().rpc("set_profile_status", {
      p_user_id: accountId,
      p_status: "disabled",
    });
  },
  changePassword,
};
