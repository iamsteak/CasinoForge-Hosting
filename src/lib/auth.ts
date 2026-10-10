import { createSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/clients";

export type OwnerCheck =
  | { ok: true; userId: string; email: string }
  | { ok: false; status: 401 | 403 | 503; message: string };

export async function requireOwner(): Promise<OwnerCheck> {
  if (!isSupabaseConfigured()) {
    return { ok: false, status: 503, message: "Owner authentication is not configured." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, status: 401, message: "Sign in to continue." };
  }

  const ownerEmail = process.env.SUPABASE_OWNER_EMAIL?.trim().toLowerCase();
  const email = data.user.email?.trim().toLowerCase();
  if (!ownerEmail || !email || email !== ownerEmail) {
    return { ok: false, status: 403, message: "This account is not allowed to control the bot." };
  }

  return { ok: true, userId: data.user.id, email };
}

export function ownerEmailMatches(email?: string | null) {
  const ownerEmail = process.env.SUPABASE_OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(ownerEmail && email?.trim().toLowerCase() === ownerEmail);
}
