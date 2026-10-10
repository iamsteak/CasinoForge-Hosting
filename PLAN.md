# Botdock implementation plan

## Product scope
A private one-bot control panel with the visual language and operational affordances of a public hosting platform. The control panel can manage one configured Railway worker; it is not a multi-tenant product.

## Architecture
- **Next.js 16 / React** runs on Vercel. Route handlers provide the same-origin, server-only API proxy to Railway.
- **Supabase Auth** provides the owner login. Only the configured owner email is admitted; the UI has no signup path.
- **Supabase Postgres** stores a small operational activity trail. Application tables deny direct `anon`/`authenticated` access; guarded server routes write through a server-only Supabase secret key.
- **Railway** runs the persistent Discord gateway worker. A Railway project token and project/service/environment IDs are server-side Vercel variables. The panel reads deployment history/logs, deploys the configured service, restarts/stops the current deployment, rolls back, and manages environment-variable names/values through Railway's GraphQL API. Variable values never enter Supabase or client responses.
- The bot's source and Discord credentials remain owned by the user and must be connected to the Railway service before a live deploy can run.

## Project structure
- `src/app/`: owner gate, sign-in page, global style system, same-origin API route handlers.
- `src/components/`: responsive hosting dashboard, navigation, status, history, console, and environment-variable controls.
- `src/lib/`: Supabase browser/server/admin clients, owner authorization, Railway GraphQL adapter, and typed domain data.
- `supabase/migrations/`: activity table and least-privilege access controls.
- `.env.example`, `README.md`: local/Vercel configuration and deployment steps.

## Design
- **Design movement:** restrained dark operations console, combining infrastructure dashboards with an editorial product UI.
- **Core principles:** one bot is the clear unit of control; live state is explicit rather than simulated; secrets are managed server-side; actions are visible, reversible where possible, and scoped to one worker.
- **Color philosophy:** ink/navy surfaces establish focus; cool slate supports hierarchy; a crisp mint signal marks healthy/active states and a warm amber/red signal marks attention or destructive actions.
- **Layout paradigm:** persistent narrow left rail, a high-signal service header, asymmetrical two-column operational canvas, and a full-width monospace log console.
- **Signature elements:** compact deployment-state capsule; thin luminous mint activity rail; console surfaces with timestamp/level columns.
- **Interaction philosophy:** actions remain disabled until integrations are configured; mutations return explicit outcomes; stop and rollback require in-product confirmation.
- **Animation:** short 140–200 ms transitions for nav, hover, and status changes; no perpetual motion except a subtle live indicator when a real worker is connected.
- **Typography system:** Geist Sans for interface hierarchy, Geist Mono for IDs, variables, timestamps, and logs; title/body/caption contrast stays deliberate and legible.
- **Brand essence:** Botdock is a private operations deck for one Discord bot, with hosting-platform clarity and no multi-tenant clutter. Personality: precise, calm, capable.
- **Brand voice:** concise infrastructure language, no claims of health without a real response. Example lines: “One worker. Every control in one place.” and “Waiting for a Railway service connection.”
- **Wordmark & logo:** custom outlined dock glyph with a centered bot-status spark, paired with a small lowercase wordmark.
- **Signature brand color:** bright mint `#80F0C0`.
