export class DbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DbError";
  }
}

export function dbErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    if (/abort|timeout|failed to fetch|network|load failed/i.test(error.message)) {
      return "Could not reach Supabase. The local API is not reachable.";
    }
    return error.message;
  }
  return fallback;
}
