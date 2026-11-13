# Team Pulse — Jira dashboard

Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · GSAP · Motion · ECharts.
Exports: PDF (jsPDF), Excel (ExcelJS), PowerPoint with native, editable charts (pptxgenjs).

## Run

```bash
cp .env.example .env.local   # JIRA_EMAIL + JIRA_API_TOKEN (must belong to the same Atlassian account)
npm install
npm run dev                  # http://localhost:3000
npm run format               # Prettier (+ Tailwind class order) — run before committing
```

Without credentials the app runs on clearly labelled **sample data**. With bad credentials it shows the
error Jira returned instead of an empty dashboard.

## Teams

- **Core Engineering** is a saved team (`src/config/teams.ts`). Members are listed by Jira display name;
  on first load each name is looked up in Jira and the match is cached in the browser.
  Anyone not found shows "Not found in Jira yet" in the Team sheet with a **Link** button.
- Only issues assigned to team members are fetched (`assignee in (...)`).
- Extra teams can be created in the UI.

## Database (teams, members, saved views)

Set `DATABASE_URL` in `.env.local` (Postgres; the server is exposed on **5555**, 5432 is its internal port):

```
DATABASE_URL=postgres://USER:PASSWORD@100.82.209.47:5555/DBNAME   # URL-encode the password: # → %23
```

- Tables (`teams`, `team_members`, `saved_views`) are created automatically on first request
  (`src/lib/db/schema.ts`); `npm run db:push` does the same through drizzle-kit, `npm run db:studio` opens a browser.
- Core Engineering is inserted automatically if it's missing.
- The browser keeps a copy as an offline cache. On the first successful connection, teams, settings and saved
  views that exist only in the browser are uploaded.
- The top bar shows where teams are saved: **Saved** (database), **Browser** (no `DATABASE_URL`), or **DB error**.
- API: `GET /api/teams`, `PUT /api/teams/:id`, `DELETE /api/teams/:id`. There is no login on these routes yet —
  run the app only on your internal network.

## Design system & atomic structure

No hand-written CSS. `src/app/globals.css` is only the Tailwind entry point (two lines).

| Layer                                                     | Where                                                                                                                                         |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens (colour light/dark, radius, shadow, motion, fonts) | `src/design/tokens.ts` → `tailwind.config.mts` (utility classes + CSS variables)                                                              |
| Atoms                                                     | `src/components/atoms` — Button, Input, Avatar, Badge, StatusDot, Spinner, Skeleton, Mono, EChart                                             |
| Molecules                                                 | `src/components/molecules` — Popover, MultiSelect, DateRange, Segmented, FilterChip, Overlay, Toast, Panel, KpiCard, FormatOption, Pagination |
| Organisms                                                 | `src/components/organisms` — TopBar, TeamHeader, FilterBar, KpiGrid, ChartsGrid, IssueList, ExportDialog, TeamSheet, ConnectionBanner         |
| Template                                                  | `src/components/templates/DashboardTemplate.tsx`                                                                                              |
| Page                                                      | `src/components/pages/TeamDashboard.tsx` (all state lives here)                                                                               |

Charts and exports read the same tokens via `src/lib/theme.ts`, so changing `accent` in
`tokens.ts` recolours the UI, the charts, and the PDF/Excel/PPT output together.

## Docker (Ubuntu x86-64)

Build on any machine (Apple Silicon included) for the server's `linux/amd64`:

```bash
./scripts/docker-build.sh 1.0.0                    # → team-pulse:1.0.0 in local Docker
OUTPUT=tar ./scripts/docker-build.sh 1.0.0         # → team-pulse-1.0.0-amd64.tar
```

The raw command the script runs:

```bash
docker buildx build --platform linux/amd64 --pull --provenance=true --sbom=true \
  -t team-pulse:1.0.0 --load .
```

Copy to the server and run:

```bash
scp team-pulse-1.0.0-amd64.tar user@server:~
ssh user@server
docker load -i team-pulse-1.0.0-amd64.tar
docker tag team-pulse:1.0.0 team-pulse:latest
# create .env.production with JIRA_* and DATABASE_URL, next to docker-compose.yml
docker compose up -d
curl http://localhost:3000/api/health      # → {"ok":true}
```

Image: Node 26 LTS (Debian slim, pinned by digest), Next.js standalone output, non-root user,
npm removed from the runtime image, read-only filesystem in compose. See `SECURITY.md`.
