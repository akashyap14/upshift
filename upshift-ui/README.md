# Upshift UI

React + Vite front end for Upshift v3 (UPSHIFT-SPEC v3). One project, two apps:

- **`/app`, mobile player app (employees):** splash, demo sign-in, assigned packs and today's news round,
  rides sized to your commute (voice or tap), points after every answer, Gear Card, rewards with one-time codes.
- **`/admin`, company web app (LMS, managers and leaders):** upload documents, AI-generated question packs
  with word-for-word quote checks, review/edit/approve, assign to teams, leaders' dashboard, rewards catalogue.

## Run

```sh
npm install
npm run dev:mock   # no backend needed: a browser-side mock serves the whole API
npm run dev        # against upshift-backend on :8080 (override with API_TARGET=...)
```

Open http://localhost:5173/app or http://localhost:5173/admin. For a deployed build pointing at another host,
set `VITE_API_BASE`.

The mock keeps its data in localStorage (reset with `localStorage.removeItem('upshift.mock.v1')` in the
console). It can't read PDF/DOCX in the browser, so those uploads use a sample policy text; TXT/MD are read for real.

## API

The UI codes against the contract in [API.md](API.md) (spec §6 plus a few additions the screens need).
Types are in `src/api/types.ts`. upshift-backend doesn't implement the v3 endpoints yet; until it does,
use `npm run dev:mock`.

Voice uses the browser's speech recognition (en-IN, hold-to-talk) and speech synthesis; both need Chrome
over HTTPS or localhost.

## End-to-end tests

Playwright, using your installed Chrome (no browser download). Start the backend first, then:

```sh
npm run e2e                        # API + UI tests; builds and serves the production bundle on :4173
npx playwright test --project=api  # just the backend API checks
npx playwright show-report e2e-report
```

- `e2e/api.spec.ts`: technical checks of the backend's quiz API (contract, validation, errors, answer-key
  secrecy, web search sources, CORS, concurrency, latency).
- `e2e/ui.spec.ts`: written for the v2 quiz screens, which v3 replaced. It needs rewriting for `/app` and
  `/admin` before it will pass.

## Structure

- `src/main.tsx`: router (`/`, `/app/*`, `/admin/*`), React Query, session, optional mock
- `src/api/`: contract types, fetch client, React Query hooks, demo session, browser mock (`mock/`)
- `src/app/`: mobile screens (Login, Home, Ride, RoundCard, GearCard, Rewards) and `app.css`
- `src/admin/`: LMS pages (Documents, Packs, PackReview, Assign, Dashboard, Rewards) and `admin.css`
- `src/components/`: brand (Logo, Splash), DemoLogin, Sky, Bloom, Motif, Road, Kinetic
- `src/lib/`: professions and tints, speech (recognition, read-aloud, A/B/C parsing), theme
- `src/styles/tokens.css`: design tokens (day and night) and shared base styles
