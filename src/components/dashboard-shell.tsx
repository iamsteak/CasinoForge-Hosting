"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity, Download, ArrowRight, Bot, Check, ChevronRight, AlertCircle,
  CheckCircle2, Clock3, Code2, ExternalLink, FileText, Key, Loader2,
  LogOut, Play, Plus, Power, RefreshCw, RotateCw, Server, Settings2,
  ShieldCheck, Terminal, Trash2, AlertTriangle, Wifi, X,
} from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import type { ActivityItem, Deployment, OverviewData, RuntimeLog } from "@/lib/types";

type View = "overview" | "deployments" | "console" | "variables" | "activity" | "settings";
const NAV: Array<{ id: View; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "deployments", label: "Deployments", icon: Download },
  { id: "console", label: "Runtime logs", icon: Terminal },
  { id: "variables", label: "Variables", icon: Key },
  { id: "activity", label: "Activity", icon: Clock3 },
];
const EMPTY: OverviewData = { connected: false, activityReady: false, missing: [], project: null, deployments: [], variableNames: [], activity: [] };
const DISPLAY_MISSING = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_OWNER_EMAIL", "SUPABASE_SECRET_KEY", "RAILWAY_API_TOKEN", "RAILWAY_PROJECT_ID", "RAILWAY_SERVICE_ID", "RAILWAY_ENVIRONMENT_ID"];

function shortId(id: string) { return id.length > 14 ? `${id.slice(0, 7)}…${id.slice(-5)}` : id; }
function timeAgo(date?: string) {
  if (!date) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
function formatDate(date?: string) {
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}
function statusKind(status = "") {
  const value = status.toLowerCase();
  if (value === "success") return "good";
  if (["failed", "crashed"].includes(value)) return "bad";
  if (["building", "deploying", "queued", "waiting"].includes(value)) return "pending";
  if (["removed", "sleeping", "stopped"].includes(value)) return "muted";
  return "muted";
}
function humanStatus(status?: string) {
  if (!status) return "Not connected";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function DashboardShell({ setupMode = false, userEmail }: { setupMode?: boolean; userEmail?: string }) {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<OverviewData>(EMPTY);
  const [loading, setLoading] = useState(!setupMode);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [logs, setLogs] = useState<RuntimeLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [savingVariable, setSavingVariable] = useState(false);

  const loadOverview = useCallback(async (quiet = false) => {
    if (setupMode) return;
    if (quiet) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/overview", { cache: "no-store" });
      if (response.status === 401) { router.replace("/login"); return; }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not read the hosting service.");
      setData(payload as OverviewData);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the hosting service.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, setupMode]);

  const loadLogs = useCallback(async () => {
    if (setupMode || !data.connected) return;
    setLogsLoading(true);
    try {
      const latest = data.deployments[0]?.id;
      const query = latest ? `?deploymentId=${encodeURIComponent(latest)}` : "";
      const response = await fetch(`/api/logs${query}`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) setLogs((payload.logs ?? []) as RuntimeLog[]);
      else setError(payload.error ?? "Could not load runtime logs.");
    } catch {
      setError("Could not load runtime logs.");
    } finally { setLogsLoading(false); }
  }, [data.connected, data.deployments, setupMode]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadOverview());
    return () => window.cancelAnimationFrame(frame);
  }, [loadOverview]);
  useEffect(() => {
    if (view !== "console" || !data.connected) return;
    const frame = window.requestAnimationFrame(() => void loadLogs());
    const timer = window.setInterval(() => void loadLogs(), 20_000);
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(timer); };
  }, [view, data.connected, loadLogs]);

  const latest = data.deployments[0];
  const deploymentStatus = latest?.status;
  const projectLabel = data.project ?? "Your Railway worker";
  const currentViewTitle = useMemo(() => ({ overview: "Overview", deployments: "Deployments", console: "Runtime logs", variables: "Variables", activity: "Activity", settings: "Settings" })[view], [view]);

  async function runAction(action: "deploy" | "restart" | "stop" | "rollback", deploymentId?: string) {
    if ((action === "stop" || action === "rollback") && !window.confirm(action === "stop" ? "Stop the active bot deployment? The Discord bot will disconnect until it is started again." : "Roll back the worker to this previous deployment?")) return;
    setBusyAction(action + (deploymentId ?? ""));
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...(deploymentId ? { deploymentId } : {}) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The action could not be completed.");
      setNotice(payload.message ?? "Action accepted by Railway.");
      await loadOverview(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be completed.");
    } finally { setBusyAction(""); }
  }

  async function saveVariable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingVariable(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/variables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim(), value: newValue }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Variable could not be saved.");
      setNotice(payload.message); setNewName(""); setNewValue(""); await loadOverview(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Variable could not be saved."); }
    finally { setSavingVariable(false); }
  }

  async function deleteVariable(name: string) {
    if (!window.confirm(`Delete ${name} from the Railway worker? This change is not automatically deployed.`)) return;
    setError(""); setNotice("");
    try {
      const response = await fetch("/api/variables", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Variable could not be deleted.");
      setNotice(payload.message); await loadOverview(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Variable could not be deleted."); }
  }

  async function signOut() {
    try { await createSupabaseBrowser().auth.signOut(); } finally { router.replace("/login"); }
  }

  const statusClass = statusKind(deploymentStatus);
  const isActionDisabled = !data.connected || loading || Boolean(busyAction);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand-lockup" href="/" aria-label="Botdock home"><span className="brand-mark"><span /></span><span className="brand-word">botdock</span></Link>
        <div className="workspace-switcher"><div className="workspace-avatar"><Bot size={17} /></div><div className="workspace-copy"><span>PERSONAL WORKSPACE</span><strong>My Discord bot</strong></div><ChevronRight size={15} /></div>
        <div className="sidebar-label">CONTROL ROOM</div>
        <nav className="side-nav" aria-label="Main navigation">
          {NAV.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? "selected" : ""}`} onClick={() => { setView(id); setNotice(""); }}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{id === "deployments" && data.deployments.length > 0 && <small>{data.deployments.length}</small>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-item ${view === "settings" ? "selected" : ""}`} onClick={() => setView("settings")}><Settings2 size={17} /><span>Settings</span></button>
          <div className="sidebar-rule" />
          <div className="profile-row"><div className="profile-avatar">{userEmail?.slice(0, 1).toUpperCase() || "M"}</div><div className="profile-copy"><strong>{userEmail ?? "Local preview"}</strong><span>{setupMode ? "Setup preview" : "Owner account"}</span></div>{!setupMode && <button className="icon-button signout-button" title="Sign out" onClick={signOut}><LogOut size={16} /></button>}</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="breadcrumbs"><span>Botdock</span><ChevronRight size={14} /><strong>{currentViewTitle}</strong></div><div className="topbar-actions"><span className={`connection-pill ${data.connected ? "connected" : "disconnected"}`}><span />{setupMode ? "SETUP REQUIRED" : data.connected ? "RAILWAY CONNECTED" : "NOT CONNECTED"}</span><button className="icon-button top-refresh" title="Refresh status" onClick={() => loadOverview(true)} disabled={refreshing || setupMode}><RefreshCw size={16} className={refreshing ? "spin" : ""} /></button></div></header>

        <div className="content-wrap">
          <div className="page-heading"><div><p className="eyebrow">PRIVATE RUNTIME / 01 SERVICE</p><h1>{view === "overview" ? "Your bot, in view." : currentViewTitle}</h1><p className="page-subtitle">{view === "overview" ? "One worker. Every control in one place." : view === "console" ? "Live output from your latest Railway deployment." : view === "variables" ? "Manage the runtime environment without exposing values in this panel." : view === "deployments" ? "Inspect releases and roll back when you need to." : view === "activity" ? "A private record of changes made from this control room." : "Connect and secure your one-bot workspace."}</p></div><button className="button button-primary deploy-button" disabled={isActionDisabled} onClick={() => runAction("deploy")}><Play size={15} fill="currentColor" />{busyAction === "deploy" ? "Queueing…" : "Deploy latest"}</button></div>

          {setupMode && <div className="setup-banner"><div className="setup-banner-icon"><Settings2 size={19} /></div><div><strong>This is a disconnected preview</strong><p>Connect Supabase and Railway in Vercel to unlock real service controls. No sample data is being shown.</p></div><button className="text-link" onClick={() => setView("settings")}>View setup <ArrowRight size={15} /></button></div>}
          {error && <div className="inline-alert error-alert" role="alert"><AlertCircle size={17} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><X size={15} /></button></div>}
          {notice && <div className="inline-alert success-alert" role="status"><CheckCircle2 size={17} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}

          {view === "overview" && <OverviewView data={data} latest={latest} projectLabel={projectLabel} statusClass={statusClass} setupMode={setupMode} loading={loading} busyAction={busyAction} onAction={runAction} onView={setView} logs={logs} logsLoading={logsLoading} onLoadLogs={loadLogs} />}
          {view === "deployments" && <DeploymentsView deployments={data.deployments} connected={data.connected} loading={loading} busyAction={busyAction} onAction={runAction} />}
          {view === "console" && <ConsoleView logs={logs} loading={logsLoading} connected={data.connected} onRefresh={loadLogs} />}
          {view === "variables" && <VariablesView names={data.variableNames} connected={data.connected} setupMode={setupMode} newName={newName} newValue={newValue} saving={savingVariable} onName={setNewName} onValue={setNewValue} onSave={saveVariable} onDelete={deleteVariable} />}
          {view === "activity" && <ActivityView items={data.activity} />}
          {view === "settings" && <SettingsView data={data} setupMode={setupMode} />}

          <footer className="page-footer"><span><ShieldCheck size={14} /> Private workspace · one Discord worker</span><span>Botdock <b>·</b> Railway runtime</span></footer>
        </div>
      </main>
    </div>
  );
}

function OverviewView({ data, latest, projectLabel, statusClass, setupMode, loading, busyAction, onAction, onView, logs, logsLoading, onLoadLogs }: {
  data: OverviewData; latest?: Deployment; projectLabel: string; statusClass: string; setupMode: boolean; loading: boolean; busyAction: string;
  onAction: (action: "deploy" | "restart" | "stop" | "rollback", deploymentId?: string) => void; onView: (view: View) => void;
  logs: RuntimeLog[]; logsLoading: boolean; onLoadLogs: () => void;
}) {
  const stateText = setupMode ? "Setup required" : loading ? "Connecting…" : !data.connected ? "Not connected" : humanStatus(latest?.status ?? "No deploys");
  return <>
    <section className="overview-hero">
      <div className="hero-gridlines" />
      <div className="hero-main"><div className="hero-kicker"><span className="tiny-square" /> SINGLE BOT SERVICE <span className="hero-divider">/</span> DISCORD GATEWAY</div><div className="hero-title-row"><div className="hero-bot-avatar"><Bot size={24} /></div><div><h2>discord-bot</h2><p>{projectLabel}</p></div></div><div className="hero-status-row"><span className={`status-chip ${statusClass}`}><span className="status-dot" />{stateText}</span><span className="hero-hint">Railway deployment state · not a Discord gateway heartbeat</span></div></div>
      <div className="hero-side"><div className="hero-status-label">LATEST DEPLOYMENT</div><div className="hero-deploy-id">{latest ? shortId(latest.id) : "—"}</div><div className="hero-deploy-time">{latest ? formatDate(latest.createdAt) : setupMode ? "Connect Railway to begin" : "No deployment data"}</div><div className="hero-actions"><button className="button button-ghost" disabled={!data.connected || !latest || Boolean(busyAction)} onClick={() => onAction("restart")}><RotateCw size={14} />Restart</button><button className="button button-ghost danger-ghost" disabled={!data.connected || !latest || Boolean(busyAction)} onClick={() => onAction("stop")}><Power size={14} />Stop</button></div></div>
    </section>
    <div className="metrics-row">
      <MetricCard label="DEPLOYMENT STATUS" value={latest ? humanStatus(latest.status) : "—"} icon={<Wifi size={16} />} tone={latest && statusKind(latest.status) === "good" ? "mint" : "slate"} foot={latest ? `Updated ${timeAgo(latest.createdAt)}` : "Awaiting Railway connection"} />
      <MetricCard label="DEPLOY HISTORY" value={data.connected ? String(data.deployments.length) : "—"} icon={<Download size={16} />} tone="slate" foot={data.connected ? "Recent deployments" : "No service data"} />
      <MetricCard label="RUNTIME VARIABLES" value={data.connected ? String(data.variableNames.length) : "—"} icon={<Key size={16} />} tone="amber" foot="Names only · values stay in Railway" />
      <MetricCard label="LAST DEPLOY" value={latest ? timeAgo(latest.createdAt) : "—"} icon={<Clock3 size={16} />} tone="slate" foot={latest ? formatDate(latest.createdAt) : "No deploy recorded"} />
    </div>
    <div className="overview-grid">
      <section className="panel deploy-panel"><PanelHeading title="Recent deployments" meta={data.connected ? `${data.deployments.length} shown` : "—"} action={<button className="panel-link" onClick={() => onView("deployments")}>All deployments <ChevronRight size={14} /></button>} />
        {loading ? <SkeletonRows /> : data.deployments.length ? <div className="deployment-list">{data.deployments.slice(0, 4).map((deployment, index) => <DeploymentRow key={deployment.id} deployment={deployment} current={index === 0} compact />)}</div> : <EmptyState icon={<Server size={18} />} title={setupMode ? "Your worker will appear here" : "No deployments yet"} detail={setupMode ? "Connect Railway to load its deployment history." : data.connected ? "Deploy the configured service to create its first release." : "Add your Railway project, service and environment IDs in Settings."} />}
      </section>
      <section className="panel service-panel"><PanelHeading title="Service details" meta={<span className="subtle-tag"><span className="tiny-square" /> WORKER</span>} />
        <div className="detail-stack"><Detail label="Service" value="discord-bot" icon={<Bot size={15} />} /><Detail label="Provider" value="Railway" icon={<Server size={15} />} /><Detail label="Project" value={data.project ?? "Not connected"} icon={<Code2 size={15} />} /><Detail label="Environment" value={data.connected ? "Configured in Vercel" : "Not configured"} icon={<Settings2 size={15} />} /></div>
        <div className="service-note"><AlertTriangle size={15} /><span>Worker status reflects Railway deployment state. Discord gateway health needs an app-level heartbeat.</span></div>
      </section>
    </div>
    <section className="panel console-preview"><PanelHeading title="Runtime console" meta={<span className="console-live-label"><span className="live-dot" />{logsLoading ? "REFRESHING" : data.connected ? "RAILWAY LOGS" : "WAITING"}</span>} action={<button className="panel-link" onClick={() => { onView("console"); if (!logs.length) onLoadLogs(); }}>Open console <ChevronRight size={14} /></button>} />
      <div className="console-lines">{logs.length ? logs.slice(0, 4).map((log, index) => <LogLine key={`${log.timestamp}-${index}`} log={log} />) : <div className="console-empty">{setupMode || !data.connected ? "Connect Railway to stream deployment output." : "No log lines for the latest deployment yet."}</div>}</div>
    </section>
  </>;
}

function MetricCard({ label, value, icon, tone, foot }: { label: string; value: string; icon: React.ReactNode; tone: string; foot: string }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><strong>{value}</strong><small>{foot}</small></div>;
}
function PanelHeading({ title, meta, action }: { title: string; meta?: React.ReactNode; action?: React.ReactNode }) {
  return <div className="panel-heading"><div className="panel-heading-left"><h3>{title}</h3>{meta && <span className="panel-meta">{meta}</span>}</div>{action}</div>;
}
function EmptyState({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{detail}</p></div>;
}
function Detail({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="detail-row"><span className="detail-label"><span className="detail-icon">{icon}</span>{label}</span><span className="detail-value" title={value}>{value}</span></div>;
}
function DeploymentRow({ deployment, current, compact = false, onRollback }: { deployment: Deployment; current: boolean; compact?: boolean; onRollback?: (id: string) => void }) {
  return <div className={`deployment-row ${compact ? "compact" : ""}`}><div className="deploy-row-state"><span className={`status-dot ${statusKind(deployment.status)}`} /><span className="deployment-status-text">{humanStatus(deployment.status)}</span>{current && <span className="current-tag">CURRENT</span>}</div><div className="deploy-row-id mono">{shortId(deployment.id)}</div><div className="deploy-row-date"><span>{timeAgo(deployment.createdAt)}</span><small>{formatDate(deployment.createdAt)}</small></div>{!compact && <div className="deploy-row-actions">{deployment.url && <a className="icon-button" title="Open deployment URL" href={deployment.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a>}{!current && deployment.canRollback && onRollback && <button className="button button-small button-secondary" onClick={() => onRollback(deployment.id)}><RotateCw size={13} />Rollback</button>}{!current && !deployment.canRollback && <span className="not-available">Rollback unavailable</span>}</div>}</div>;
}
function DeploymentsView({ deployments, connected, loading, busyAction, onAction }: { deployments: Deployment[]; connected: boolean; loading: boolean; busyAction: string; onAction: (action: "deploy" | "restart" | "stop" | "rollback", deploymentId?: string) => void }) {
  return <section className="panel full-panel"><PanelHeading title="Release history" meta={connected ? `${deployments.length} recent` : "Not connected"} action={<button className="button button-secondary button-small" onClick={() => onAction("deploy")} disabled={!connected || Boolean(busyAction)}><Play size={13} />Deploy service</button>} />
    <div className="deploy-table-head"><span>STATUS</span><span>DEPLOYMENT</span><span>CREATED</span><span>ACTIONS</span></div>
    {loading ? <SkeletonRows /> : deployments.length ? deployments.map((deployment, index) => <DeploymentRow key={deployment.id} deployment={deployment} current={index === 0} onRollback={(id) => onAction("rollback", id)} />) : <EmptyState icon={<Download size={18} />} title="Deployment history is empty" detail={connected ? "Trigger your first Railway deployment to begin tracking releases." : "Connect the Railway service to see its real deployment history."} />}
  </section>;
}
function ConsoleView({ logs, loading, connected, onRefresh }: { logs: RuntimeLog[]; loading: boolean; connected: boolean; onRefresh: () => void }) {
  return <section className="panel full-panel terminal-panel"><PanelHeading title="Runtime console" meta={<span className="console-live-label"><span className={connected ? "live-dot" : ""} />{connected ? "LATEST DEPLOYMENT" : "DISCONNECTED"}</span>} action={<button className="button button-secondary button-small" onClick={onRefresh} disabled={!connected || loading}><RefreshCw size={13} className={loading ? "spin" : ""} />Refresh</button>} /><div className="terminal-toolbar"><span><span className="terminal-window-dot red"/><span className="terminal-window-dot yellow"/><span className="terminal-window-dot green"/></span><span className="mono">railway · runtime logs</span><span>20s refresh</span></div><div className="terminal-output">{logs.length ? logs.map((log, index) => <LogLine key={`${log.timestamp}-${index}`} log={log} />) : <div className="console-empty">{loading ? "Reading Railway logs…" : connected ? "No runtime output available for this deployment." : "Connect the Railway worker to read real runtime logs."}</div>}</div><p className="log-safety-note"><ShieldCheck size={14} /> Logs are fetched from Railway on request. Do not print bot tokens or other secrets in your worker logs.</p></section>;
}
function LogLine({ log }: { log: RuntimeLog }) {
  const level = (log.severity || "info").toLowerCase();
  return <div className="log-line"><time>{log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}</time><span className={`log-level ${level}`}>{level.slice(0, 4).toUpperCase()}</span><code>{log.message}</code></div>;
}
function VariablesView({ names, connected, setupMode, newName, newValue, saving, onName, onValue, onSave, onDelete }: { names: string[]; connected: boolean; setupMode: boolean; newName: string; newValue: string; saving: boolean; onName: (value: string) => void; onValue: (value: string) => void; onSave: (event: React.FormEvent<HTMLFormElement>) => void; onDelete: (name: string) => void }) {
  return <div className="variables-layout"><section className="panel variable-panel"><PanelHeading title="Runtime variables" meta={connected ? `${names.length} keys` : "Not connected"} /><div className="secret-callout"><div className="secret-callout-icon"><ShieldCheck size={17} /></div><div><strong>Values stay out of this panel</strong><p>Keys are listed from Railway. Values are sent to Railway over the server only and never returned to your browser or stored in Supabase.</p></div></div>
    {connected ? names.length ? <div className="variable-list">{names.map(name => <div className="variable-row" key={name}><div className="variable-key"><Key size={15} /><code>{name}</code></div><span className="secret-mask">••••••••••••</span><span className="variable-source">RAILWAY</span><button className="icon-button delete-variable" onClick={() => onDelete(name)} title={`Delete ${name}`}><Trash2 size={15} /></button></div>)}</div> : <EmptyState icon={<Key size={18} />} title="No variables found" detail="Add the Discord token and bot settings as Railway service variables." /> : <EmptyState icon={<Key size={18} />} title="Connect a Railway service" detail="Once connected, existing worker keys appear here without exposing their values." />}
    {connected && <form className="variable-form" onSubmit={onSave}><div className="form-section-heading"><div><strong>Add or update a variable</strong><p>Updates are saved in Railway but do not redeploy the worker automatically.</p></div><span className="secure-tag"><ShieldCheck size={13} /> SERVER-ONLY</span></div><div className="variable-inputs"><label>Variable name<input value={newName} onChange={event => onName(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))} required maxLength={128} placeholder="DISCORD_TOKEN" autoComplete="off" /></label><label>Secret value<input value={newValue} onChange={event => onValue(event.target.value)} required type="password" maxLength={8192} placeholder="Enter value — it will not be shown again" autoComplete="new-password" /></label><button className="button button-primary" disabled={saving || !newName || !newValue}>{saving ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}{saving ? "Saving…" : "Save variable"}</button></div></form>}
    {setupMode && <p className="setup-inline-hint">This preview has no Railway credentials. Configure the `RAILWAY_*` values in Vercel to enable this page.</p>}
  </section><aside className="panel variable-aside"><div className="aside-icon mint-icon"><Key size={17} /></div><p className="eyebrow">BOT CREDENTIALS</p><h3>Keep secrets on the worker.</h3><p>Put your Discord bot token in Railway’s service variables. Botdock can help manage it without persisting the value.</p><div className="aside-divider"/><div className="aside-list-item"><Check size={14} /> Never commit tokens to GitHub</div><div className="aside-list-item"><Check size={14} /> Values never enter the activity feed</div><div className="aside-list-item"><Check size={14} /> Deploy after updates to apply changes</div></aside></div>;
}
function ActivityView({ items }: { items: ActivityItem[] }) {
  return <section className="panel full-panel"><PanelHeading title="Control-room activity" meta={`${items.length} entries`} />{items.length ? <div className="activity-list">{items.map(item => <div className="activity-row" key={item.id}><div className={`activity-icon ${item.outcome}`}><Activity size={15} /></div><div className="activity-copy"><strong>{item.summary}</strong><span>{item.action.replaceAll("_", " ")} · {item.outcome}</span></div><time>{formatDate(item.created_at)}</time></div>)}</div> : <EmptyState icon={<Clock3 size={18} />} title="No activity yet" detail="Deploy and service changes made here will appear in this private Supabase-backed history." />}</section>;
}
function SettingsView({ data, setupMode }: { data: OverviewData; setupMode: boolean }) {
  const rows = [
    { label: "Supabase Auth", detail: setupMode ? "Add project URL, publishable key and owner email" : "Owner-only sign-in configured", ready: !setupMode },
    { label: "Supabase activity store", detail: data.activityReady ? "Activity table is available" : "Add the server key and run the included migration", ready: data.activityReady },
    { label: "Railway API token", detail: data.missing.includes("RAILWAY_API_TOKEN") ? "Add a project-scoped token in Vercel" : "Token configured on server", ready: !data.missing.includes("RAILWAY_API_TOKEN") },
    { label: "Project / service / environment", detail: data.connected ? "One worker is connected" : "Add the three Railway identifiers in Vercel", ready: data.connected },
  ];
  return <div className="settings-layout"><section className="panel full-panel"><PanelHeading title="Control-plane connections" meta="PRIVATE CONFIGURATION" /><div className="settings-intro"><p>Botdock does not keep credentials in the repository. Add configuration in Vercel’s project environment settings, then redeploy the site to apply changes.</p><a className="button button-secondary button-small" href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">Open Vercel <ExternalLink size={14} /></a></div><div className="settings-rows">{rows.map((row, index) => <div className="settings-row" key={row.label}><div className={`settings-check ${row.ready ? "ready" : ""}`}>{row.ready ? <Check size={15} /> : <span>{String(index + 1).padStart(2, "0")}</span>}</div><div className="settings-copy"><strong>{row.label}</strong><span>{row.detail}</span></div><span className={`settings-status ${row.ready ? "ready" : "pending"}`}>{row.ready ? "READY" : "SETUP"}</span></div>)}</div><div className="settings-footnote"><AlertCircle size={16} /><p>Railway deployment state does not confirm that the Discord Gateway is connected. Add an app-level heartbeat to your bot for end-to-end health checks.</p></div></section><section className="panel full-panel"><PanelHeading title="Required Vercel variables" meta="SERVER-SIDE ONLY WHERE MARKED" /><div className="required-env-list">{DISPLAY_MISSING.map(name => <div key={name}><code>{name}</code><span>{name.startsWith("NEXT_PUBLIC_") ? "Public client setting" : "Server secret / service binding"}</span></div>)}</div><p className="env-doc-link"><FileText size={14} /> Full setup guide: README.md in the connected repository</p></section></div>;
}
function SkeletonRows() {
  return <div className="skeleton-stack" aria-label="Loading"><span/><span/><span/><span/></div>;
}
