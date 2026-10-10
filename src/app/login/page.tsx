import { redirect } from "next/navigation";
import LoginForm from "@/app/login/login-form";
import { createSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/clients";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/");
  }
  return <LoginForm configured={isSupabaseConfigured()} />;
}
