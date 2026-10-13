export const AUTH_SESSION_EVENT = "nature-biotic-auth-session";
export const AUTH_RECOVERY_EVENT = "nature-biotic-auth-recovery";

export function emitAuthSession() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
}

export function emitAuthRecovery() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_RECOVERY_EVENT));
}
