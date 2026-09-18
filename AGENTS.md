# AGENTS.md

Guidance for AI agents working in this repository.

## Project Overview

**The Stylus** is a browser-based tool that lets 3 Card Blind MTG "gurus" edit result sheets for matches hosted on [3cardblind.com](https://www.3cardblind.com). It is a pure client-side application: no backend, no build step, no server dependencies.

- **Stack:** HTML5, CSS3, native ES6 modules
- **External APIs:** Google Sheets API v4, Google Drive API v3, Google OAuth 2.0 (GIS), Scryfall API (card images)
- **Persistence:** Google Sheets (match data) and Google appData / browser `localStorage` (config, signatures, recent pods/hubs)
- **Hosting:** static files, also installable as a PWA (`site.webmanifest` + `sw.js`)

## Domain Logic (read this before touching scoring code)

A 3 Card Blind match is between two players, each with a 3-card deck. The outcome is decided by human **gurus** who analyse the match and score it **Win / Tie / Loss** (`ANALYSIS_VALUES` = 1.0 / 0.5 / 0.0 in `js/utils/constants.js`).

- Three gurus cover each match, one per colour: **Red, Blue, Green** — each scores from their own perspective.
- A guru must **claim** a match by entering their **guru signature** before scoring it. The signature is what other gurus see to know the match is taken.
- A guru can only analyse matches they have claimed.
- A **pod** is a group of matches; a **hub** aggregates threads/pods (see `HubManager`).
- Matches may also be scored as **goldfish** (a signature variant) — preserve this behaviour.

## Repository Structure

```
the-stylus/
├── index.html                  # Single-page app markup (loads Google APIs + js/main.js as a module)
├── js/
│   ├── main.js                 # Entry point: ThreeCardBlindGuruTool bootstrap + init flow
│   ├── config.js               # Google OAuth client ID, scopes, discovery docs, localStorage keys
│   ├── modules/                # ES6 class-based feature modules
│   │   ├── authManager.js
│   │   ├── deckNotesEditor.js
│   │   ├── googleSheetsAPI.js
│   │   ├── guruAnalysisInterface.js   # Largest module; scoring UI + flow
│   │   ├── guruSignature.js
│   │   ├── hubManager.js
│   │   ├── recentPods.js
│   │   ├── scryfallAPI.js
│   │   ├── uiController.js            # Centralised event handling / status UI
│   │   └── userPreferences.js
│   └── utils/                  # Pure helper functions
│       ├── constants.js        # STATUS_TYPES, ANALYSIS_VALUES, TIME_CONSTANTS
│       ├── domUtils.js         # Safe DOM access
│       ├── podUtils.js         # pod name <-> code conversion
│       └── urlUtils.js         # Sheet URL validation/parsing/sanitising
├── styles/main.css             # All application styles
├── sw.js                       # Service worker: APP_VERSION, precache list, Scryfall cache
├── site.webmanifest            # PWA manifest
├── favicons/ images/           # Static assets
├── tests/
│   ├── unit/                   # node:test suites (node --test)
│   ├── e2e/                    # Playwright specs + in-browser Google/Scryfall stubs
│   └── fixtures/               # Shared sheet-data fixtures and fake gapi
├── playwright.config.js        # Playwright config (dev-only; serves files statically)
├── .github/
│   ├── workflows/tests.yml     # CI: runs unit + e2e on push/PR to main
│   └── copilot-instructions.md
└── package.json                # Metadata + dev-only test scripts (no runtime deps)
```

## Development Workflow

No install or build is required. Serve the files statically:

```bash
python -m http.server 8000   # then open http://localhost:8000
```

- Always start by reading `index.html` and `js/main.js`.
- Modules use ES6 `import`/`export`; follow the import chain to understand dependencies. Import paths are **case-sensitive**.
- Google APIs are loaded from CDN, so the app needs network access to fully run.
- Verify syntax without a build tool: `node -c <file>` (no ESLint config exists; `node --check` is equivalent).
- There is a CI workflow at `.github/workflows/tests.yml` that runs both suites
  on pushes and pull requests to `main`. Ask before adding further workflows.

### Testing

The app has no backend and the public app ships zero dependencies, so tests must
run without Google credentials, without network access, and without adding
anything to the shipped bundle. Playwright is a **devDependency only** — never
add a runtime dependency or reference test files from `index.html`/`sw.js`.

```bash
npm install                    # installs Playwright (dev only)
npm run test:e2e:install       # one-time Chromium download
npm test                       # unit + e2e
npm run test:unit              # node:test only (fast, no browser)
npm run test:e2e               # Playwright only
```

**Unit tests** (`tests/unit/`, built-in `node:test`, no dependencies):
- `js/utils/*` is pure and imported directly.
- `GuruAnalysisInterface` logic is tested via `Object.create(GuruAnalysisInterface.prototype)`
  and an explicit fake `this`. The constructor calls `bindEvents()` and needs a
  DOM, so do not `new` it in unit tests.
- `GoogleSheetsAPI` is tested against a fake global `gapi` (`tests/fixtures/fakeGapi.js`)
  that records requests. Tests assert on the requests and the transformations.
  Change the module to read `gapi` lazily; do not capture it at import time.

**E2E tests** (`tests/e2e/`): Playwright drives the real app in Chromium over
`python -m http.server`. `tests/e2e/stubs.js` installs an in-browser model of a
spreadsheet plus stubs for `gapi`, Google Identity Services, Drive appData and
Scryfall images. The Google CDN scripts and OpenID endpoints are blocked by
`page.route`. Tests assert on real cells written by the app, which is what
catches off-by-one/column-mapping regressions.

Notes:
- The stub disables `navigator.serviceWorker`; otherwise its `controllerchange`
  handler reloads the page mid-test.
- Keep fixtures shaped like the real API payloads (ragged rows, header row at
  range index 0) so parsing paths stay honest.
- Some tests intentionally document current quirks rather than desired behaviour
  (look for the "Characterization:" comments). Update those deliberately.

### CI billing

This repository is public, so standard GitHub-hosted runners are free and
unlimited for it; only the minutes cap applies to private repos. Storage is the
part that is *not* unlimited, even here. Two consequences for the test workflow:

- Artifacts share a pooled allowance with GitHub Packages and are billed by
  GB-hour. `test-results/` (Playwright traces) grows quickly, so the workflow
  deliberately does not upload it. If you ever add an upload step, set
  `retention-days` low and `if-no-files-found: ignore`.
- Avoid larger runners. They are always charged, even for public repositories or
  when plan quota is unused.

Keep `runs-on: ubuntu-latest` (a standard runner) and the browser cache stays
under the separate 10 GB-per-repository cache allowance.

### Updating the service worker cache

When you add, remove, or rename a file under `js/`, `styles/`, `images/`, or `favicons/`, you must keep the precache list in `sw.js` (`urlsToCache`) in sync, or the file will be missing offline.

### Bumping the version

`APP_VERSION` at the top of `sw.js` (format `vYYYYMMDD`) drives service worker updates. Bump it for any user-visible change so installed clients pick it up. `main.js` parses this value for the footer.

## Conventions

- **Indentation:** 4 spaces. Never tabs.
- **Quotes:** single quotes, with backticks for template literals. Double quotes only for HTML attributes inside template strings.
- **Modules:** `export class X` with a `constructor` that wires dependencies; shared helper functions live in `js/utils/` as named exports.
- **DOM access:** use helpers from `js/utils/domUtils.js` (`getElement`, `waitForElement`, `addEventListenerSafe`) rather than direct `document.getElementById`, so missing elements degrade gracefully.
- **Event handling:** register UI events in `uiController.js` / the owning module's setup method rather than inline `onclick` handlers.
- **Config:** `js/config.js` holds the public OAuth client ID and storage keys. Do not move secrets here; `public/js/config.local.js` is gitignored for local overrides.
- **No new dependencies:** the project deliberately loads everything from CDNs and ships no bundler. Confirm with the user before adding a package. Playwright is the one agreed exception, and it is dev-only: it must never be imported by app code or added to `sw.js`/`index.html`.
- **Commits:** short imperative subjects, often `<Area>: <change>` (e.g. `Fix next button not going to current guru's matches first`).

## Keeping Docs in Sync

After code changes:

1. Update the Repository Structure above if files were added/removed/renamed.
2. Update `README.md` if user-facing behaviour or usage changed.
3. Update `.github/copilot-instructions.md` when architecture changes.
4. Bump `APP_VERSION` in `sw.js` if the change is user-visible.

## Troubleshooting

- **`gapi is not defined` / `ERR_BLOCKED_BY_CLIENT`:** expected in sandboxed or offline environments where Google APIs cannot load. These are not app bugs; focus on whether the page structure and modules loaded.
- **Module fails to load:** check the exact path and casing of the import.
- **Stale behaviour after editing:** the service worker may be serving a cached build. Bump `APP_VERSION` and hard-reload, or unregister the worker in devtools.
- **Sheet fails to parse:** inspect the URL handling in `js/utils/urlUtils.js`; Discord-pasted links can carry trailing characters (previously handled by trimming extra `),`).
- **Syntax check:** `node -c <filename>`.