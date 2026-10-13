import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function allowedRedirect(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "capacitor:") return true;
    const local =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return local && (url.protocol === "http:" || url.protocol === "https:");
  } catch {
    return false;
  }
}

function duplicateEmail(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("already") ||
    text.includes("registered") ||
    text.includes("exists") ||
    text.includes("duplicate")
  );
}

const AUTH_URL = "http://auth:9999";

function authHeaders(serviceKey: string) {
  return {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    "Content-Type": "application/json",
  };
}

async function readAuthBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function authErrorMessage(body: Record<string, unknown>, fallback: string) {
  for (const key of ["msg", "message", "error_description", "error"]) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

async function inviteAuthUser(
  serviceKey: string,
  email: string,
  fullName: string,
  redirectTo: string,
) {
  const url = new URL(`${AUTH_URL}/invite`);
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders(serviceKey),
    body: JSON.stringify({
      email,
      data: { full_name: fullName },
    }),
  });
  const body = (await readAuthBody(response)) as Record<string, unknown>;
  const user = body.user && typeof body.user === "object" ? body.user as { id?: string } : null;
  const id = typeof body.id === "string" ? body.id : user?.id;
  if (!response.ok) {
    return {
      id,
      error: authErrorMessage(body, "The store login could not be created."),
    };
  }
  return { id, error: null as string | null };
}

async function findAuthUserId(serviceKey: string, email: string) {
  const response = await fetch(`${AUTH_URL}/admin/users?page=1&per_page=200`, {
    headers: authHeaders(serviceKey),
  });
  if (!response.ok) return null;
  const body = (await readAuthBody(response)) as { users?: { id?: string; email?: string }[] };
  const match = (body.users || []).find(
    (user) => String(user.email || "").trim().toLowerCase() === email,
  );
  return match?.id || null;
}

async function deleteNewAuthUser(serviceKey: string, userId: string) {
  await fetch(`${AUTH_URL}/admin/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(serviceKey),
  });
}

function existingAccountMessage(
  profile: { role: string; store_id: string | null },
  storeId: string,
) {
  if (profile.role === "store_admin" && profile.store_id === storeId) {
    return "This account is already the administrator for this store.";
  }
  if (profile.role === "company_admin") {
    return "An account with this email already exists. A company admin account cannot be linked to a store.";
  }
  if (profile.role === "store_admin") {
    return "An account with this email already exists. It is already linked to another store and was not changed.";
  }
  return "An account with this email already exists. It was not changed.";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json(405, { error: "Store login provisioning only accepts POST." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(500, {
      error: "Store login provisioning is not configured on the server.",
    });
  }

  const authorization = request.headers.get("Authorization")?.trim();
  const accessToken = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    return json(401, { error: "Sign in as a company admin before creating a store login." });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return json(401, { error: "Sign in as a company admin before creating a store login." });
  }

  const profileResult = await userClient
    .from("profiles")
    .select("role, status")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileResult.error) {
    return json(403, { error: "The company admin profile could not be verified." });
  }
  if (
    profileResult.data?.role !== "company_admin" ||
    profileResult.data?.status !== "active"
  ) {
    return json(403, { error: "Only an active company admin can create a store login." });
  }

  let body: {
    email?: string;
    full_name?: string;
    store_id?: string;
    redirect_to?: string;
    reassign?: boolean;
    resend?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "The store login request was not valid." });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.full_name || "").trim();
  const storeId = String(body.store_id || "").trim();
  const redirectTo = String(body.redirect_to || "").trim();
  const reassign = body.reassign === true;
  const resend = body.resend === true;
  if (!isEmail(email)) return json(400, { error: "Enter a valid email address." });
  if (!fullName) return json(400, { error: "Enter the store administrator's name." });
  if (!isUuid(storeId)) return json(400, { error: "Choose a saved store before creating a login." });
  if (redirectTo && !allowedRedirect(redirectTo)) {
    return json(400, { error: "The password setup address is not allowed." });
  }

  const storeResult = await userClient
    .from("stores")
    .select("id, status")
    .eq("id", storeId)
    .maybeSingle();
  if (storeResult.error || !storeResult.data) {
    return json(400, { error: "That store was not found." });
  }
  if (storeResult.data.status !== "active") {
    return json(400, { error: "An inactive store cannot have a login." });
  }

  const existingProfile = await userClient
    .from("profiles")
    .select("id, role, status, store_id")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile.error) {
    return json(400, { error: "The email could not be checked." });
  }
  if (existingProfile.data) {
    const profile = existingProfile.data;
    const sameStoreAdmin =
      profile.role === "store_admin" && profile.store_id === storeId;
    const canMove =
      profile.role === "store_admin" &&
      Boolean(profile.store_id) &&
      profile.store_id !== storeId;
    if (resend) {
      if (!sameStoreAdmin) {
        return json(409, {
          error: existingAccountMessage(profile, storeId),
          can_reassign: canMove,
        });
      }
      if (profile.status !== "active") {
        return json(400, {
          error: "This store login is disabled. The password email was not sent.",
        });
      }
      const resent = await inviteAuthUser(serviceKey, email, fullName, redirectTo);
      if (resent.error) {
        return json(duplicateEmail(resent.error) ? 409 : 400, {
          error: duplicateEmail(resent.error)
            ? "This account already completed password setup. It was not changed."
            : resent.error,
        });
      }
      return json(200, {
        id: profile.id,
        email,
        full_name: fullName,
        role: "store_admin",
        store_id: profile.store_id,
        password_setup_resent: true,
      });
    }
    if (canMove && reassign) {
      if (profile.status !== "active") {
        return json(400, { error: "This store login is disabled and was not moved." });
      }
      const moved = await userClient
        .from("profiles")
        .update({ store_id: storeId })
        .eq("id", profile.id)
        .eq("role", "store_admin")
        .select("id, store_id")
        .maybeSingle();
      if (moved.error || !moved.data || moved.data.store_id !== storeId) {
        return json(400, {
          error: moved.error?.message || "The store login could not be moved.",
        });
      }
      return json(200, {
        id: profile.id,
        email,
        full_name: fullName,
        role: "store_admin",
        store_id: storeId,
        existing_account_linked: true,
        reassigned: true,
      });
    }
    return json(409, {
      error: existingAccountMessage(profile, storeId),
      can_reassign: canMove,
      can_resend: sameStoreAdmin,
    });
  }
  if (resend) {
    return json(400, {
      error: "This email is not a store administrator yet. Use Invite Store Admin to create the login.",
    });
  }

  const invited = await inviteAuthUser(serviceKey, email, fullName, redirectTo);
  let invitedId = invited.id;
  let linkedExisting = false;
  if (invited.error || !invitedId) {
    if (!duplicateEmail(invited.error || "")) {
      return json(400, {
        error: invited.error || "The store login could not be created.",
      });
    }
    invitedId = await findAuthUserId(serviceKey, email);
    if (!invitedId) {
      return json(409, {
        error: "An account with this email already exists. It was not changed.",
      });
    }
    linkedExisting = true;
  }

  const linked = await userClient.rpc("link_store_user", {
    p_user_id: invitedId,
    p_store_id: storeId,
    p_full_name: fullName,
  });
  if (linked.error) {
    if (!linkedExisting) await deleteNewAuthUser(serviceKey, invitedId);
    const message = linked.error.message || "The store login could not be linked.";
    return json(duplicateEmail(message) ? 409 : 400, {
      error: duplicateEmail(message)
        ? "An account with this email already exists. It was not changed."
        : message,
    });
  }

  return json(200, {
    id: invitedId,
    email,
    full_name: fullName,
    role: "store_admin",
    store_id: storeId,
    existing_account_linked: linkedExisting,
  });
});
