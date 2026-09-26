# Upshift UI

Mobile-first React + Vite front end for Upshift: pick a profession, level, track and ride time, answer multiple-choice rounds (tap or press A–D; questions can be read aloud), and arrive at a Gear Card with your score, the right answers and explanations. Grading happens on the server when you arrive.

## Run

1. Start the backend (see `../upshift-backend/README.md`) on port 8080.
2. In this folder:

```sh
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to `http://localhost:8080` (override with `API_TARGET=... npm run dev`). For a deployed build pointing at another host, set `VITE_API_BASE`.

Read-aloud uses the browser's speech synthesis.

## End-to-end tests

Playwright, using your installed Chrome (no browser download). Start the backend first, then:

```sh
npm run e2e                        # API + UI tests; builds and serves the production bundle on :4173
npx playwright test --project=ui   # just the browser tests
npx playwright show-report e2e-report
```

- `e2e/api.spec.ts`: technical checks of the backend API (contract, validation, errors, answer-key
  secrecy, web search sources, CORS, concurrency, latency).
- `e2e/ui.spec.ts`: functional rides in the browser. "stubbed" tests fake the API to check UI
  behaviour exactly; "live" tests play real rides against the backend and Claude.

A full run makes ~13 real Claude calls (a few with web search), so it costs a few cents.

## Structure

- `src/lib/professions.ts` — the 10 professions, tints, motifs, level pacing, round sizing
- `src/lib/api.ts` — client for `POST /api/questions/generate` and `/evaluate`
- `src/lib/speech.ts` — read-aloud (plus hold-to-talk recognition, currently unused)
- `src/components/` — sky, bloom, motif, profession picker, road bar
- `src/screens/` — Setup → Round → Gear Card
- `src/styles.css` — design tokens first, then components (see DESIGN.md)
