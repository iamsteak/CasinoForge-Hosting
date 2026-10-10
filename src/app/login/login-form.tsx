"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) return;
    setBusy(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace("/");
      router.refresh();
    } catch {
      setMessage("That sign-in didn’t work. Check your owner credentials and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <div className="login-card">
        <div className="login-brand"><div className="brand-mark"><span /></div><span>botdock</span></div>
        <div className="login-intro">
          <div className="login-icon"><Lock size={19} /></div>
          <p className="eyebrow">OWNER ACCESS ONLY</p>
          <h1>Your bot’s control room.</h1>
          <p>Sign in with the single owner account connected to this workspace.</p>
        </div>
        {configured ? (
          <form className="login-form" onSubmit={submit}>
            <label>Email address<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>
            <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Your Supabase password" /></label>
            {message && <p className="form-error" role="alert">{message}</p>}
            <button className="button button-primary login-submit" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in securely"}<ArrowRight size={16} /></button>
          </form>
        ) : (
          <div className="setup-notice">
            <ShieldCheck size={18} />
            <div><strong>Supabase needs to be connected</strong><p>Add the Supabase URL, publishable key and owner email to your Vercel environment variables, then redeploy.</p></div>
          </div>
        )}
        <div className="login-footer"><ShieldCheck size={15} /><span>Private by design · no public sign-ups</span></div>
      </div>
      <div className="login-aside"><div className="aside-orbit orbit-one"/><div className="aside-orbit orbit-two"/><div className="aside-copy"><span className="signal-pulse"/><p className="eyebrow">ONE WORKER. YOUR RULES.</p><h2>Keep your bot<br/>close to the metal.</h2><p>Deploy, inspect and manage your Discord worker from one quiet place.</p></div><div className="aside-caption"><span>BOTDOCK / PRIVATE RUNTIME</span><span>01 — 01</span></div></div>
    </main>
  );
}
