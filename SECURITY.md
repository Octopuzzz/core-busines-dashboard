# Security notes

## npm supply-chain protection

Several npm supply-chain attacks were reported in November 2026: a campaign that hijacked GitHub
accounts and planted a CI secret stealer as an npm `postinstall` hook (reported 12 Nov), PolinRider
(hidden loaders in 10 hijacked packages, 9 Nov) and the Ethersphere package compromise. This project
was checked on 2026-11-12: **none of the named packages are in `package-lock.json`**, and
`npm audit` reports 0 vulnerabilities.

Protections now in place:

| Where                                    | What                                                                               | Why                                                                                                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.npmrc`                                 | `min-release-age=7`                                                                | Only versions published ≥ 7 days ago are installed. Malicious releases are usually pulled within hours/days.                                                               |
| `.npmrc` + `package.json` `allowScripts` | `strict-allow-scripts=true`                                                        | Install scripts (`postinstall`…) only run if approved. Any new, unreviewed script fails the install. Currently: none approved, `core-js` denied (it only prints a banner). |
| `.npmrc`                                 | `save-exact=true`                                                                  | New dependencies are pinned exactly — no silent upgrades.                                                                                                                  |
| `package.json` `overrides`               | `uuid ^11.1.1`, `image-size ^2.1.0`, `minimatch ^11.0.8` (under typescript-eslint) | Patched versions of vulnerable transitive dependencies (GHSA-w5hq-g745-h8pq, GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr, GHSA-g3hv-75wg-m249).                               |
| Docker build                             | `npm ci` + `npm audit signatures`                                                  | Exact lockfile install, registry signatures verified.                                                                                                                      |
| Docker image                             | no npm/npx, non-root, read-only FS                                                 | Nothing in the running container can install or modify packages.                                                                                                           |
| `.dockerignore`                          | excludes all `.env*`                                                               | Secrets are never baked into the image; they're passed at runtime.                                                                                                         |

Note: some attacks (e.g. PolinRider) run when the package is _imported_, not at install, so blocking
install scripts alone isn't enough — `min-release-age` and reviewing lockfile diffs matter too.

### Day-to-day

```bash
npm ci                       # install exactly the lockfile (use this, not `npm install`, in CI)
npm run audit:ci             # audit (fails on high/critical) + verify signatures
npm install-scripts ls       # see packages asking to run install scripts
npm install-scripts approve <pkg>   # only after reviewing what the script does
```

Review `package-lock.json` changes in every PR — unexpected new packages are the main warning sign.

## Secrets

- `.env.local` / `.env.production` hold the Jira token and database password. They are git- and
  docker-ignored. Never paste them into chat, tickets or commits.
- The Jira token and database password were shared in a chat during setup — **rotate both**.
- The dashboard has no login yet; keep it on the internal network (or behind a VPN / reverse proxy
  with auth).
