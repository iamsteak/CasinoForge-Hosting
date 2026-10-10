# Botdock

A private hosting control panel for one Discord bot. Vercel serves the Next.js interface and server-side API routes, Supabase handles owner authentication and the audit trail, and Railway runs the persistent Discord worker.

## What works in this repository

- Owner-only sign-in; no public account creation.
- Live Railway deployment list/status, runtime logs, and environment-variable **names**.
- Deploy the configured Railway service, restart or stop its active deployment, and roll back to an available prior deployment.
- Add/update/delete worker environment variables through server-side Railway requests. Values never go to the browser or Supabase. Variable changes do not auto-deploy; deploy explicitly afterward.
- Supabase-backed activity history for control-panel actions.

The selected repository was empty when implementation began, and no bot source repository was supplied. The panel can control a preconfigured Railway service once its IDs and secrets are added, but your Discord bot code and token still need to be connected to that worker. A separate persistent worker is required because a Discord Gateway connection must stay alive; Vercel Functions are used only for the control panel/API proxy.

## Setup

1. Create a Supabase project. In **Authentication → Providers / Signups**, disable public sign-ups. Create your owner user yourself in the Supabase dashboard.
2. Run [`supabase/migrations/20261010000000_bot_activity.sql`](supabase/migrations/20261010000000_bot_activity.sql) in the Supabase SQL Editor.
3. Configure a Railway service as a persistent worker for your Discord bot source. Add the Discord token to Railway's service variables there; do not put it in this repository. Copy the Railway project, service, and target environment IDs. Create a project token scoped to the target project/environment.
4. Import this GitHub repository into Vercel. Set the variables in `.env.example` in **Vercel → Project → Settings → Environment Variables**. `SUPABASE_SECRET_KEY` and all `RAILWAY_*` variables must remain server-only (never add the `NEXT_PUBLIC_` prefix). Set `SUPABASE_OWNER_EMAIL` to the one allowed account.
5. Deploy on Vercel. On first visit, sign in with the Supabase owner account. The panel validates that account against `SUPABASE_OWNER_EMAIL` on the server.

## Local development

```bash
cp .env.example .env.local
# Fill in the Supabase and Railway values in .env.local
pnpm install
pnpm dev
```

The dashboard renders an explicit disconnected/setup state when credentials are absent; it does not invent sample deploys, logs, or resource metrics.

## Security notes

- Never commit `.env.local`, Supabase secret keys, Railway API tokens, or Discord bot tokens.
- The Supabase secret key is used only by owner-checked server handlers; exposed tables have RLS enabled and no `anon`/`authenticated` grants.
- Railway secrets are returned to the server only to filter names or send a requested mutation; values are not persisted in Supabase or included in API responses.
- Use a Railway project token scoped to the one worker's project/environment.
- Stopping a deployment interrupts the bot; the UI asks for confirmation. Rollback is restricted to deployments Railway marks as rollback-capable.
