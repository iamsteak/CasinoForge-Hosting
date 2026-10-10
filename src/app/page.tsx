import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { ownerEmailMatches } from "@/lib/auth";
import { createSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/clients";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!isSupabaseConfigured()) return <DashboardShell setupMode />;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!ownerEmailMatches(user.email)) {
    return (
      <main className="access-screen">
        <div className="access-card">
          <div className="brand-mark"><span /></div>
          <p className="eyebrow">PRIVATE WORKSPACE</p>
          <h1>This account doesn’t have access.</h1>
          <p>Sign out and use the owner account configured for this Botdock instance.</p>
          <a className="button button-secondary" href="/login">Return to sign in</a>
        </div>
      </main>
    );
  }
  return <DashboardShell userEmail={user.email ?? undefined} />;
}
