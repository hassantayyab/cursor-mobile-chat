# plan.md — “Cursor Chat on Mobile” (read-only viewer + safe action triggers)

> Build a mobile app that shows your **complete Cursor chats** and lets you **trigger safe actions** (Agents via Web, Slack, or GitHub). Start scrappy; ship a weekend MVP; harden to production.

---

## 0) App Summary

**Name (working):** CursorChat Mobile  
**Goal:** See all Cursor chat threads on your phone (search, read), receive live updates from your desktop, and trigger safe, auditable actions (Cursor Agents via web, Slack mentions, GitHub PR comments).  
**Core pieces:**

- **Desktop Companion (Node CLI):** Watches Cursor’s local SQLite (`state.vscdb` variants), extracts chats, and streams them to your backend.
- **Backend (Express/Fastify):** Normalizes & serves threads/messages; provides WebSocket for realtime; exposes action endpoints.
- **Mobile App (Expo/React Native):** Thread list + message view, with “Run action…” sheet that deep-links to official Agent surfaces or triggers Slack/GitHub flows.

**Principles:** privacy-first, read-only by default, minimize coupling to Cursor internals (schema drift tolerant), graceful degradation if offline.

---

## 1) Architecture & Data Flow (text diagram)

```
[Cursor Desktop]
   └─ local SQLite (state.vscdb [+ wal/backup])
         │  (file watcher → copy-to-tmp → parse JSON blobs)
         ▼
[Desktop Companion CLI]
   └─ normalize → diff → upsert
         │ (HTTPS POST /ingest + WS)     ┌───────────────────────────┐
         ├──────────────────────────────► │ Backend (API + WS broker) │
         │                                └───────────────────────────┘
         │                                        │            ▲
         │                                        │ WS events  │
         │                                        ▼            │
         │                               [Mobile App (Expo)]   │
         │                                        │            │
         │                                        ▼            │
         │                                 [Action endpoints]  │
         │                                /actions/slack       │
         │                                /actions/github      │
         └─ (optional) open deep-link →   /actions/agents → deep-link to official PWA
```

---

## 2) Scope & Milestones

- **M0 – Scaffolding (Day 0)**
- **M1 – Extract & Mirror (Weekend MVP)**
- **M2 – Backend APIs & Realtime**
- **M3 – Mobile Viewer (Read-Only)**
- **M4 – Safe Actions (Agents/Slack/GitHub)**
- **M5 – Hardening (Security, Tests, Observability)**
- **M6 – Production Release (CI/CD, packaging, store-ready paths)**

Each milestone has a Definition of Done (DoD).

---

## 3) Project Setup (Monorepo)

**Tech choices:** TypeScript everywhere; pnpm; Turborepo (or Nx); Zod for runtime types; ws or Socket.IO for realtime; Expo (managed).

```
/cursor-mobile-chat/
  apps/
    desktop-companion/       # Node CLI (watcher + extractor + sync)
    server/                  # Fastify/Express + ws
    mobile/                  # Expo/React Native app
  packages/
    shared/                  # types, zod schemas, utils
    extractor/               # SQLite parsers + adapters (composer/chatdata)
  .github/workflows/
  package.json
  pnpm-workspace.yaml
  turbo.json
```

---

## 4) Detailed TODOs / Checklists

### M0 — Scaffolding (Day 0) ✅ COMPLETED

- [x] Create monorepo: `pnpm init -y && pnpm dlx create-turbo@latest` (or Nx)
- [x] Set workspace: `pnpm-workspace.yaml` for `apps/*` and `packages/*`
- [x] Add TS configs: base `tsconfig.json` + per-package extends
- [x] Packages:
  - [x] `packages/shared` with `zod`, shared `types.ts` for Thread/Message
  - [x] `packages/extractor` with deps: `better-sqlite3`, `fast-deep-equal`, `chokidar`
- [x] Apps:
  - [x] `apps/desktop-companion` (Node): CLI entry, env loader, logging
  - [x] `apps/server` (Fastify or Express): REST + WS skeleton
  - [x] `apps/mobile` (Expo): TypeScript template with React Navigation, TailwindCSS v4, React Query
- [x] Add scripts: `pnpm dev:*` per app; root `pnpm dev` runs all
- [x] Prettier + ESLint + EditorConfig
- [ ] License (MIT) & `CODE_OF_CONDUCT.md`
- [x] `.env.example` for each app
- **DoD M0**
  - [x] `pnpm dev` boots all three apps (skeleton functionality)
  - [x] Lint passes & typecheck clean

**Architecture Implemented:**
- Complete monorepo structure with TypeScript
- Mobile app with navigation, state management (Zustand), and UI framework (NativeWind/Tailwind v4)
- Server with Fastify, WebSocket support, Swagger docs, and authentication middleware
- Desktop companion CLI with extraction capabilities
- Shared package with comprehensive types and utilities
- Extractor package with safe SQLite reading and dual adapter support (chatdata/composer)

**What's Ready:**
- Mobile app can connect to server, display threads/messages, settings screen
- Server provides REST API skeleton with WebSocket support
- Desktop companion can extract and normalize Cursor chat data
- All packages properly typed and configured

---

### M1 — Extract & Mirror (Weekend MVP)

**Goal:** Read local Cursor chats safely and print normalized JSON to console.

- [ ] Implement **safe DB read** helper in `packages/extractor`:
  - [ ] Discover paths: macOS/Windows/Linux for `globalStorage` & `workspaceStorage`
  - [ ] Copy `state.vscdb` (+ `.wal`/`.backup` if present) to tmp before open
  - [ ] Open read-only; simple query runner
- [ ] Implement **adapters** (schema tolerant):
  - [ ] `adapter.chatdata`: reads keys `workbench.panel.aichat.view.aichat.chatdata`, `aiService.prompts`
  - [ ] `adapter.composer`: reads keys like `composerData:*` (newer schema)
- [ ] **Normalizer**: convert adapter outputs into `{Thread[], Message[]}`
- [ ] Unit tests: snapshot small fixture DBs (sanitized) → assert normalized shape
- [ ] `apps/desktop-companion` CLI:
  - [ ] CLI flags: `--dry`, `--once`, `--watch`, `--server-url`
  - [ ] On `--once`: print normalized JSON to stdout
  - [ ] On `--watch`: file watch → incremental diff (hash by message id) → emit JSON
- **DoD M1**
  - [ ] `pnpm --filter desktop-companion dev --once` prints threads/messages
  - [ ] Unit tests for extractor pass (fixtures committed)

---

### M2 — Backend APIs & Realtime

**Goal:** Accept ingests; serve list/detail; broadcast updates.

- [ ] Server structure:
  - [ ] `POST /ingest` accepts `{threads, messages}` (idempotent upserts)
  - [ ] `GET /threads?workspaceId=&q=&limit=&cursor=` (search + pagination)
  - [ ] `GET /threads/:id?cursor=` (paged messages, newest-last)
  - [ ] `GET /healthz`
  - [ ] `WS /live` emits events: `thread.updated`, `message.created`
- [ ] Memory store first; hide behind a repository interface
- [ ] Add simple full-text index (FlexSearch/Lunr) for `q` (or pg_trgm later)
- [ ] Auth (MVP): shared token via `Authorization: Bearer` (env-configured)
- [ ] Wire companion → server:
  - [ ] On changes, POST diffs to `/ingest`
  - [ ] On failure, retry with backoff; local queue when offline
- [ ] Add OpenAPI (Swagger) for endpoints
- **DoD M2**
  - [ ] Desktop companion `--watch` streams to server; `GET /threads` returns data
  - [ ] WS clients receive `message.created` when new messages appear

---

### M3 — Mobile Viewer (Read-Only)

**Goal:** View threads/messages on phone with live updates.

- [ ] Expo app screens:
  - [ ] **Threads**: list, search, “unread since X” badge, pull-to-refresh
  - [ ] **Messages**: render roles, code blocks (Prism), copy buttons, timestamps
- [ ] Data layer:
  - [ ] REST for initial fetch; WS for live updates
  - [ ] Offline cache (MMKV) + optimistic UI for locally cached content
- [ ] Settings:
  - [ ] Server URL & token
  - [ ] Theme (system / light / dark)
- [ ] QA on iOS/Android (Expo Go)
- **DoD M3**
  - [ ] See real chats on phone; updates appear within seconds without reload
  - [ ] Search returns expected results

---

### M4 — Safe Actions (Agents/Slack/GitHub)

**Goal:** Trigger **auditable** actions from mobile without directly driving desktop UI.

- [ ] **Agents (web deep-link)**
  - [ ] “Run Agent…” button opens Cursor Web/Mobile Agents PWA with prefilled prompt (deep-link strategy: authenticated user opens PWA; pass prompt via query if supported or via your server storing a “draft” and instructing user to paste)
- [ ] **Slack**
  - [ ] Server endpoint `POST /actions/slack` → posts “@Cursor <prompt>” to configured channel
  - [ ] Mobile sheet: templates (“Run tests”, “Fix lint”, “Summarize PR #…”), freeform textbox
- [ ] **GitHub**
  - [ ] Server endpoint `POST /actions/github-comment` → comments on a PR/issue with “@cursor <prompt>”
  - [ ] Mobile UI: choose repo + PR/issue (recent list or paste URL/number)
- [ ] Audit log:
  - [ ] Store action requests (`who`, `what`, `where`, `when`, `resultUrl?`)
- **DoD M4**
  - [ ] From mobile, you can kick an Agent via web deep-link, mention Cursor in Slack, or comment on a PR—and see links to results

---

### M5 — Hardening (Security, Tests, Observability)

**Goal:** Production-grade reliability & privacy.

- [ ] **Security**
  - [ ] TLS everywhere (use Tailscale or Cloudflare Tunnel for private deployments)
  - [ ] Token-based auth → short-lived tokens; rotate via server UI
  - [ ] Rate limiting + request size limits on `/ingest`
  - [ ] Redaction: companion filters env-like secrets before send (basic regex)
  - [ ] “Local-only mode” toggle (no external server; LAN WS)
- [ ] **Testing**
  - [ ] Unit tests: extractor, diffing, reducers
  - [ ] Integration tests: server endpoints + WS using mocked companion
  - [ ] Mobile E2E smoke (Detox) for Threads/Messages
- [ ] **Observability**
  - [ ] Structured logs (pino) with request IDs
  - [ ] Basic metrics: ingests/min, WS clients, action successes/failures
  - [ ] Error tracking: Sentry in all apps (respect PII redaction)
- **DoD M5**
  - [ ] Security review checklist passes; load test up to your expected scale
  - [ ] All tests run in CI; coverage thresholds met

---

### M6 — Production Release

**Goal:** CI/CD, packaging, docs, and upgrades plan.

- [ ] **CI/CD (GitHub Actions)**
  - [ ] Lint, typecheck, unit/integration tests on PR
  - [ ] Docker image for server; push to registry
  - [ ] Expo EAS build profiles; internal distribution
- [ ] **Desktop Companion distribution**
  - [ ] Start as Node CLI run via: macOS LaunchAgent / Windows Task Scheduler
  - [ ] Optional: package as menubar app later (Electron/Tauri) with auto-update
- [ ] **Docs**
  - [ ] `README` with quickstart (local & prod)
  - [ ] `SECURITY.md` (threat model, data flows, configs)
  - [ ] `OPERATIONS.md` (backups, rotations, upgrades)
- [ ] **Compliance & Legal**
  - [ ] Review Cursor terms for sharing chat content outside machine
  - [ ] Choose license (MIT/Apache-2.0) and mark third-party deps
- [ ] **Upgrade/Drift**
  - [ ] Versioned adapters; feature-flag to toggle `composer` vs `chatdata`
- **DoD M6**
  - [ ] You can invite a teammate to use it end-to-end with minimal hand-holding

---

## 5) Implementation Sketches

### 5.1 Extractor (packages/extractor)

- **Path discovery** (pseudo):
  - macOS: `~/Library/Application Support/Cursor/User/{globalStorage,workspaceStorage}/**/state.vscdb`
  - Windows: `%APPDATA%\Cursor\User\{globalStorage,workspaceStorage}\**\state.vscdb`
  - Linux: `~/.config/Cursor/User/...`
- **SQL**:
  ```sql
  SELECT key, value FROM ItemTable
   WHERE key IN ('workbench.panel.aichat.view.aichat.chatdata','aiService.prompts')
      OR key LIKE 'composerData:%';
  ```
- **Normalization strategy:**
  - Generate stable `threadId` and `messageId` hashes from source IDs + timestamps.
  - Preserve roles (`user/assistant/system/tool`) and timestamps.
  - Extract code fences into `code[]` for nicer rendering.

### 5.2 Desktop Companion (apps/desktop-companion)

- CLI flags: `--server-url`, `--token`, `--once`, `--watch`, `--full-rescan-interval=5m`
- Watchers: `chokidar` on both global & workspace storage dirs
- WAL-safe copy: copy `state.vscdb*` files to tmp dir before open
- Diffing: maintain `seenMessageIds` in-memory; send only new
- Backoff & queue: retry with jitter; persist unsent payloads to disk

### 5.3 Backend (apps/server)

- Express/Fastify; schema-validated endpoints (Zod/OpenAPI)
- Memory store with `Map` for threads/messages; easy swap to Postgres
- WS using `ws` or Socket.IO; broadcast on upserts
- Middleware: auth, rate-limit, compression, CORS (mobile whitelist)

### 5.4 Mobile (apps/mobile)

- Expo + React Query + WS client
- Screens:
  - Threads: virtualized list, search bar, filter by workspace
  - Messages: render markdown & code, jump to latest, copy buttons
- Settings: server URL, token, theme
- Polish: haptics on copy; long-press to share

---

## 6) Prompts (for your AI editor / Cursor)

- “Write a Node function to **copy a SQLite DB plus WAL/SHM** to a tmp path and open read-only.”
- “Implement an **adapter** that parses `composerData:*` JSON into `Thread[]` and `Message[]` with stable IDs.”
- “Create an **Express server** with `POST /ingest`, `GET /threads`, `GET /threads/:id`, and a **WS** broadcasting `message.created`.”
- “In Expo, build a **Threads screen** with search and infinite scroll against `GET /threads`.”
- “Add a **Slack action** endpoint that posts ‘@Cursor <prompt>’ to a channel using a bot token, and persist an **audit log** record.”
- “Write **unit tests** for the extractor using **snapshot fixtures** of sanitized SQLite DBs.”

---

## 7) Risks & Mitigations

- **Cursor schema drift** → Keep **versioned adapters**, generous JSON guards, and a feature flag to switch adapter precedence.
- **Privacy leaks** → Default **read-only**; redact obvious secrets; TLS only; offer local-only mode via Tailscale.
- **DB locking** → Always copy DB & sidecars before access.
- **Action misuse** → Require confirmation UIs; template prompts; audit log with “undo where possible” (e.g., revert PR).

---

## 8) Production Checklist (abridged)

- [ ] TLS + Auth enforced (no plaintext endpoints)
- [ ] Rate limits & body size caps on `/ingest`
- [ ] Redaction pipeline enabled
- [ ] Rotating tokens & key rotation runbooks
- [ ] Backups (server store & audit logs)
- [ ] Sentry + Metrics dashboards
- [ ] CI gates: lint, typecheck, unit, integration, E2E
- [ ] Disaster drill: server wipe → restore within RTO/RPO
- [ ] On-call basics (pager, alerts thresholds)

---

## 9) Nice-to-haves (Post v1)

- [ ] In-app **push notifications** for new messages
- [ ] **Thread starring** & tags; cross-workspace merging
- [ ] **Diff/patch view** for code blocks
- [ ] **Desktop menubar** app with an on/off toggle
- [ ] **End-to-end encryption** mode (keys on your devices only)
- [ ] **Self-host** Helm chart for server on k8s
- [ ] **Local LLM summaries** of long threads (device-only)
- [ ] **Share link** (expiring, redacted excerpts)

---

## 10) Acceptance Criteria (MVP)

- From the mobile app, I can:
  - [ ] See **all my Cursor threads** across workspaces
  - [ ] Open a thread and **read messages** with code formatting
  - [ ] Receive **live updates** within ~3s of a new desktop message
  - [ ] Trigger a **Slack** mention of `@Cursor` with a preset template and see a link to the thread/PR
  - [ ] Open the **Agents PWA** with my prompt ready to paste
- Operationally:
  - [ ] Desktop companion runs at login and survives sleep/wake
  - [ ] Server restarts without data loss (durable store optional for MVP)
  - [ ] Basic logs show ingest counts and action audits
