import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android loads the built web app from `dist`.
 * Local development stays on Vite and http://127.0.0.1:54321 via `.env`.
 * A physical device cannot use that loopback address. Point a separate
 * `.env.android` at the reviewed cloud project only after its migration
 * history is checked. Do not put a service-role key in either file.
 */
const config: CapacitorConfig = {
  appId: "in.naturebiotic.erp",
  appName: "Nature Biotic",
  webDir: "dist",
};

export default config;
