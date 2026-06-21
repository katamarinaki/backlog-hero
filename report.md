# Backlog Hero — Project Audit Report

_Generated: 2026-06-21 · Branch: `develop`_

A comprehensive review of architecture, security, code quality, testing, error
handling, dependencies, UX, and accessibility. Findings are grouped by area and
prioritized by severity.

---

## Executive Summary

Backlog Hero is a well-structured Electron + React + TypeScript desktop app with
solid baseline security (context isolation, hardened CSP, validated IPC inputs in
most handlers) and good developer hygiene (strict TS, pre-commit hooks, CI on
PRs). The most pressing issues are an **outdated Electron runtime with known
high-severity CVEs**, **missing safe handling of external links**, and a
**monolithic `main.ts`** that duplicates type definitions and network code.

Overall health: **Good foundation, needs a security + maintainability pass.**

| Area | Rating |
|------|--------|
| Security | 🟡 Needs attention (outdated runtime, link handling) |
| Architecture | 🟡 Monolithic main process, type duplication |
| Error handling | 🔴 No HTTP status checks, no timeouts, silent UI failures |
| Testing | 🟡 Only pure utils covered |
| Dependencies | 🔴 Electron + electron-store badly outdated |
| UX / A11y | 🟡 Minimal accessibility, silent error states |
| Tooling / CI | 🟢 Strong |

---

## 🔴 Critical / High

### H1 — Electron is severely outdated
- **Current:** `^28.0.0` (Dec 2023). **Latest:** `42.x`.
- Known high-severity CVEs affecting v28:
  - ASAR Integrity Bypass via resource modification (GHSA-vmqv-hx8q-j7mg)
  - AppleScript injection in `app.moveToApplicationsFolder` on macOS (GHSA-5rqw-r77c-jp79)
  - Service worker can spoof `executeJavaScript` IPC replies (GHSA-xj5x-m3f3-5x3h)
- **Action:** Upgrade to the latest stable Electron. Test the build pipeline and
  native modules afterward. This is the single highest-impact fix.

### H2 — No `setWindowOpenHandler` for external links
- The game-card modal (`View on Steam`) and settings page use
  `target="_blank"` anchors (`game-card-modal.tsx:431`, `settings-page.tsx:137,156`).
- Without a window-open handler, clicking these can spawn a new Electron
  `BrowserWindow` rather than the system browser, potentially with elevated
  privileges and bypassing CSP.
- **Action:** In `createWindow()`, add:
  ```ts
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  ```
  Also handle `will-navigate` to prevent in-app navigation away from the app.

### H3 — No HTTP status-code validation on Steam API calls
- All three `net.request` calls (`fetch-games`, `fetch-rating`,
  `fetch-achievements`) parse `response` body as JSON without checking
  `response.statusCode`.
- A `429 Too Many Requests`, `403`, or `500` returns non-JSON or an error body
  that is then `JSON.parse`d, producing a confusing "Failed to parse" error or
  silently resolving `null`.
- **Action:** Check `statusCode` (2xx) before parsing; surface rate-limit (429)
  distinctly so the UI can back off.

---

## 🟡 Medium

### M1 — `main.ts` is a 739-line monolith
- Contains: store schema, 27 IPC handlers, Steam API networking, the
  auto-updater, data migration, and backup/restore — all in one file.
- **Action:** Split into modules: `store.ts`, `steam-api.ts`, `ipc/*.ts`,
  `updater.ts`, `backup.ts`. Improves testability and readability.

### M2 — Type definitions duplicated across three files
- `GameRating`, `GameCompletion`, `GameStatus`, `GameStatusType`,
  `StatusFilter`, `GameAchievements`, `FilterPreferences`, `SteamGame` are
  defined inline in **`main.ts`** (9 types) and **`preload.ts`** (9 types) AND
  also live in **`shared/types.ts`**.
- `tsconfig.main.json` already includes `src/shared`, so the main process can
  import them.
- **Action:** Delete the inline copies, import from `@shared/types`. Single
  source of truth prevents drift.

### M3 — Duplicated Steam API networking boilerplate
- The `net.request` + promise-wrapper pattern is copy-pasted 3× with subtle
  differences.
- **Action:** Extract `fetchSteamJson(url, { timeout }): Promise<T>` helper that
  handles status codes, timeouts, JSON parsing, and errors uniformly.

### M4 — No request timeouts
- `net.request` calls have no timeout. A hung connection blocks the batch
  fetch (and its 200ms-spaced loop) indefinitely.
- **Action:** Add a timeout (e.g. 10s) per request; treat timeout as a
  recoverable failure.

### M5 — `save-settings` lacks input validation
- Unlike `save-user-rating` (range-checked) and `save-filter-preferences`
  (sanitized), `save-settings` stores whatever it receives
  (`main.ts:221`).
- **Action:** Validate that `apiKey`/`steamId` are strings of expected shape
  before persisting.

### M6 — API key stored in plaintext
- `electron-store` persists the Steam API key unencrypted in the user's config
  directory.
- **Action:** Use Electron `safeStorage` to encrypt the key at rest, or at
  minimum document the exposure in the README.

### M7 — `sandbox` not enabled
- `webPreferences` correctly sets `contextIsolation: true` and
  `nodeIntegration: false`, but does not set `sandbox: true`.
- **Action:** Enable `sandbox: true` for defense-in-depth (verify preload still
  works under sandbox).

### M8 — `electron-store` is several majors behind
- **Current:** `^6.0.1`. **Latest:** `11.x`.
- **Action:** Upgrade and adjust for the ESM/API changes in newer majors.

---

## 🟢 Low / Nits

### L1 — Silent UI error states
- `home-page.tsx` has no error handling; failed rating/achievement/library
  fetches only `console.error` in the context. The user sees nothing.
- **Action:** Surface a toast or inline error when a sync fails.

### L2 — No retry/backoff on transient failures
- A single failed request just resolves `null`. No retry for transient network
  errors or 429s.
- **Action:** Add limited retry with backoff in the shared fetch helper.

### L3 — Hardcoded `katamarinaki/backlog-hero`
- The owner/repo appears in 4 places (updater feed URLs).
- **Action:** Extract to a single constant / config.

### L4 — Minimal accessibility
- No `aria-*` attributes or `role`s anywhere in the renderer. Only 2 `alt`
  attributes. Status pills and the rating slider lack ARIA labels.
- **Action:** Add `aria-label`s to icon-only buttons, the slider, and status
  controls; ensure keyboard navigation works in the modal.

### L5 — 4 npm audit vulnerabilities
- `xmldom` (high), `ajv` (moderate), `brace-expansion` (moderate), `esbuild`
  (moderate) — mostly dev/transitive.
- **Action:** `npm audit fix` for non-breaking; evaluate the Vite/esbuild bump
  separately.

### L6 — `migrateCompletionsToStatuses` is untested
- The data-migration logic runs on every startup and mutates the store with no
  test coverage.
- **Action:** Extract the pure transform and unit-test it (empty store, legacy
  completions present, already-migrated, mixed).

---

## Testing Gaps

Current coverage: **`src/shared/gameUtils.test.ts` only (8 tests)** — covers
`formatPlaytime` and `isFetchStale` well.

Untested but testable (extract pure logic from IPC handlers first):
- Steam API response parsing (`GetOwnedGames`, `appreviews`, achievements)
- `sanitizeFilterPreferences` (validation logic)
- `migrateCompletionsToStatuses` (migration)
- `getRatingDescription` (score → label mapping)
- User-rating range validation
- GameContext filter/sort (currently inline in the provider)

---

## What's Good ✅

- `contextIsolation: true`, `nodeIntegration: false` — correct security baseline
- Hardened CSP in `index.html` (`connect-src`, `frame-src`, `object-src`,
  `base-uri`, `form-action` all locked down)
- Clean, consistent `contextBridge` preload bridge
- Strict TypeScript; no `any` abuse; `noUnusedLocals`/`noUnusedParameters`
- Import/restore path validates and sanitizes input (`isObject`,
  `sanitizeFilterPreferences`)
- Rating + filter-preference IPC handlers validate input
- Pre-commit hooks: prettier + eslint + full test suite
- CI on every PR: build, test, typecheck, lint/format
- Tag-based release flow with auto-draft, beta channel, and auto-update
- `.env` patterns gitignored; no secrets committed
- Co-located CSS modules, kebab-case convention applied consistently

---

## Recommended Priority Order

1. **H1** — Upgrade Electron (closes multiple high CVEs)
2. **H2** — Add `setWindowOpenHandler` + `will-navigate` guard
3. **H3 / M3 / M4** — Shared Steam fetch helper with status checks, timeouts, retry
4. **M2** — Consolidate types into `@shared/types`
5. **M1** — Split `main.ts` into modules
6. **M5 / M6 / M7** — Settings validation, encrypted API key, sandbox
7. **Testing** — Extract and cover parsing/migration/validation logic
8. **L1–L6** — Error UX, accessibility, dependency bumps, constants
