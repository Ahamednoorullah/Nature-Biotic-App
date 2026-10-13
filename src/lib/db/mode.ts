/** True when business screens should use local Supabase instead of localStorage. */
export function usesSupabaseData() {
  return (
    String(import.meta.env.VITE_AUTH_SOURCE || "")
      .trim()
      .toLowerCase() === "supabase"
  );
}
