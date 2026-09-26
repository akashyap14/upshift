# Upshift UI

Mobile-first React + Vite front end for Upshift: pick a profession, level, track and ride time, answer rounds by voice (hold-to-talk, en-IN) or typing, get graded by the coach, and arrive at a Gear Card.

## Run

1. Start the backend (see `../upshift-backend/README.md`) on port 8080.
2. In this folder:

```sh
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to `http://localhost:8080` (override with `API_TARGET=... npm run dev`). For a deployed build pointing at another host, set `VITE_API_BASE`.

Voice input needs Chrome (desktop or Android) and HTTPS or localhost.

## Structure

- `src/lib/professions.ts` — the 10 professions, tints, motifs, level pacing, round sizing
- `src/lib/api.ts` — client for `POST /api/questions/generate` and `/evaluate`
- `src/lib/speech.ts` — hold-to-talk recognition and read-aloud
- `src/components/` — sky, bloom, motif, profession picker, road bar
- `src/screens/` — Setup → Round → Gear Card
- `src/styles.css` — design tokens first, then components (see DESIGN.md)
