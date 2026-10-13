import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { DbError } from "@/lib/db/errors";

export function db() {
  if (!isSupabaseConfigured()) {
    throw new DbError(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for the local project.",
    );
  }
  return getSupabase();
}

export async function requireUserId() {
  const { data, error } = await db().auth.getSession();
  if (error) throw new DbError(error.message);
  const userId = data.session?.user?.id;
  if (!userId) {
    throw new DbError("Sign in is required before reading or saving business data.");
  }
  return userId;
}

export function throwIfError(
  error: { message: string } | null,
  fallback: string,
) {
  if (error) throw new DbError(error.message || fallback);
}
