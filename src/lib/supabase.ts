import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const AUTH_REMEMBER_KEY = "nature-biotic-auth-remember-v1";

function rememberEnabled() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(AUTH_REMEMBER_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setAuthRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_REMEMBER_KEY, remember ? "1" : "0");
}

const authStorage = {
  getItem(key: string) {
    if (typeof window === "undefined") return null;
    const store = rememberEnabled() ? window.localStorage : window.sessionStorage;
    return store.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === "undefined") return;
    const persist = rememberEnabled() ? window.localStorage : window.sessionStorage;
    const other = persist === window.localStorage ? window.sessionStorage : window.localStorage;
    persist.setItem(key, value);
    other.removeItem(key);
  },
  removeItem(key: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

const REQUEST_TIMEOUT_MS = 12000;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;
  return fetch(input, { ...init, signal });
}

const PASSWORD_SETUP_KEY = "nature-biotic-password-setup-v1";

export type AuthUrlCallback =
  | { kind: "invite" }
  | { kind: "recovery" }
  | { kind: "error"; message: string };

function readAuthUrlCallback(): AuthUrlCallback | null {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const type = hash.get("type") || query.get("type");
  const error = hash.get("error") || query.get("error");
  const description = hash.get("error_description") || query.get("error_description");
  if (error || description) {
    const message = description
      ? decodeURIComponent(description.replace(/\+/g, " "))
      : "This invitation link is invalid or has expired.";
    return { kind: "error", message };
  }
  if (type === "recovery") return { kind: "recovery" };
  if (type === "invite" || type === "signup" || type === "magiclink") {
    return { kind: "invite" };
  }
  return null;
}

export const authUrlCallback = readAuthUrlCallback();

export function markPasswordSetupRequired() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PASSWORD_SETUP_KEY, "1");
}

export function clearPasswordSetupRequired() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PASSWORD_SETUP_KEY);
}

export function passwordSetupRequired() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(PASSWORD_SETUP_KEY) === "1";
  } catch {
    return false;
  }
}

if (authUrlCallback?.kind === "invite") markPasswordSetupRequired();

let client: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: authStorage,
    },
    global: {
      fetch: fetchWithTimeout,
    },
  });
}

export function isSupabaseConfigured() {
  return Boolean(client);
}

/** Browser client using the anon key only. Never attach a service-role key. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push("VITE_SUPABASE_URL");
    if (!supabaseAnonKey) missing.push("VITE_SUPABASE_ANON_KEY");
    throw new Error(
      `Missing required Supabase environment variable(s): ${missing.join(
        ", ",
      )}. Please check your .env file.`,
    );
  }
  return client;
}

export const supabase = client;
