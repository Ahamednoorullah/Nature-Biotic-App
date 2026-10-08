export type StoreThemeChoice = "light" | "dark" | "system";

export type StoreUserSettings = {
  theme: StoreThemeChoice;
  sound: boolean;
};

const DEFAULT_SETTINGS: StoreUserSettings = {
  theme: "light",
  sound: false,
};

function settingsKey(userId: string) {
  return `nature-biotic-store-user-settings-v1:${userId}`;
}

function companySettingsKey(userId?: string) {
  return `nature-biotic-company-user-settings-v1:${userId || "admin"}`;
}

function readsKey(userId: string, storeId: string) {
  return `nature-biotic-store-notification-reads-v1:${userId}:${storeId}`;
}

export function readStoreUserSettings(userId: string): StoreUserSettings {
  if (typeof window === "undefined" || !userId) return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(settingsKey(userId));
    const saved = raw ? JSON.parse(raw) : {};
    const theme =
      saved?.theme === "light" || saved?.theme === "dark" || saved?.theme === "system"
        ? saved.theme
        : "light";
    return { theme, sound: saved?.sound === true };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveStoreUserSettings(userId: string, settings: StoreUserSettings) {
  if (typeof window === "undefined" || !userId) return;
  localStorage.setItem(settingsKey(userId), JSON.stringify(settings));
}

export function readCompanyUserSettings(userId?: string): StoreUserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(companySettingsKey(userId));
    const saved = raw ? JSON.parse(raw) : {};
    const theme =
      saved?.theme === "light" || saved?.theme === "dark" || saved?.theme === "system"
        ? saved.theme
        : "light";
    return { theme, sound: saved?.sound === true };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveCompanyUserSettings(
  userId: string | undefined,
  settings: StoreUserSettings,
) {
  if (typeof window === "undefined") return;
  localStorage.setItem(companySettingsKey(userId), JSON.stringify(settings));
  window.dispatchEvent(
    new CustomEvent("nature-biotic-company-theme-updated", {
      detail: settings,
    }),
  );
}

export function readNotificationReads(userId: string, storeId: string) {
  if (typeof window === "undefined" || !userId || !storeId) return [] as string[];
  try {
    const raw = localStorage.getItem(readsKey(userId, storeId));
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows.map(String) : [];
  } catch {
    return [];
  }
}

export function saveNotificationReads(
  userId: string,
  storeId: string,
  ids: string[],
) {
  if (typeof window === "undefined" || !userId || !storeId) return;
  localStorage.setItem(readsKey(userId, storeId), JSON.stringify(ids));
}

export function resolveStoreTheme(theme: StoreThemeChoice) {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
