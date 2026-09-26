# Upshift v3 — API the UI expects

This is the contract `upshift-ui` codes against (UPSHIFT-SPEC v3 §2 data model, §6 API). Exact TypeScript
shapes are in [`src/api/types.ts`](src/api/types.ts); calls are in [`src/api/client.ts`](src/api/client.ts).
A browser-side mock of every endpoint lives in [`src/api/mock/server.ts`](src/api/mock/server.ts) — it's
the reference behaviour (points rules, quote check, dashboard maths) until upshift-backend has it.

Endpoints marked **addition** aren't in the spec's §6 table but the screens need them.

## Conventions

- JSON in and out, under `/api`. Dates are ISO strings; due dates are `YYYY-MM-DD`.
- Errors: any non-2xx with `{ "message": "Human-readable text" }` (the UI shows `message` as is).
  The UI treats 502/503/504 as "server busy, try again".
- `DELETE` endpoints return 204.
- Demo auth (spec §1): the player's `user_id` is sent in the query/body as the spec shows. No tokens yet.

## Demo login

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/users` **addition** | — | `User[]` — for the role picker (Employee / Manager / Leader) |
| POST | `/api/login` | `{ user_id }` | `User` |

`User = { id, company_id, company_name, name, role, team, profession, level, points }`
(`profession` is an id like `sde`, `data`, `mkt`, `pm`, `sales`, `fin`, `hr`, `cx`, `ops`, `founder`, or `all`.)

## Documents and packs (web LMS)

| Method | Path | Body / query | Returns |
|---|---|---|---|
| POST | `/api/docs` | multipart: `file` (PDF, DOCX, TXT, MD, ≤ 20 MB), optional `title` | `DocumentSummary` |
| GET | `/api/docs` | — | `DocumentSummary[]` (newest first) |
| DELETE | `/api/docs/:id` **addition** | — | 204 (also removes its packs) |
| POST | `/api/docs/:id/generate` | `{ profession, level, count }` | `{ pack_id }` — creates a **draft** pack |
| GET | `/api/packs` **addition** | — | `PackSummary[]` — company packs only |
| GET | `/api/packs/:id` | — | `Pack` = `PackSummary` + `questions: ReviewQuestion[]` |
| POST | `/api/packs/:id/approve` | — | `PackSummary`; 400 with a message if any question is unverified |
| DELETE | `/api/packs/:id` **addition** | — | 204 |
| PATCH | `/api/questions/:id` | any editable `ReviewQuestion` fields | `ReviewQuestion`, with `verified` **re-checked** |
| DELETE | `/api/questions/:id` | — | 204 |
| POST | `/api/questions/:id/regenerate` **addition** | — | `ReviewQuestion` (new content, re-checked) |
| POST | `/api/assignments` | `{ pack_id, team, due_date }` | `Assignment`; 400 if the pack isn't approved |

- `DocumentSummary = { id, title, filename, mime, words, created_at, packs }`
- `PackSummary = { id, title, document_id, document_title, profession, level, status, question_count, unverified_count, assignments: Assignment[], created_at }`
- `ReviewQuestion = { id, pack_id, type: 'decide'|'ai_move', scenario, question, options: [a,b,c], best, second_best|null, why, source_quote, source_location, verified: boolean, open_question|null }`
- `Assignment = { id, pack_id, team, due_date }`. `team` can be `"Everyone"`. The LMS makes one call per team when several are picked, and builds its team list from `GET /api/users`.
- **Verify in code (spec §5.2):** normalise whitespace and quotes in the document text and `source_quote`;
  `verified = documentText.includes(quote)`. Unverified questions can't be approved.

## Play (mobile)

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/play/rounds` | `?user_id&eta` (+ optional `preview=1`) | `RoundsResponse` — with `preview=1` (home screen) it's read-only: don't create or reserve rounds |
| POST | `/api/play/answer` | `{ user_id, question_id, chosen, open_text? }` | `AnswerResponse` |
| POST | `/api/play/finish` **addition** | `{ user_id, question_ids }` | `FinishResponse` |

- **Rounds:** `count = clamp(floor(eta / 2.5), 1, 12)`. Unseen questions only (exclude every `question_id`
  already in `answer` for that user). Assigned packs for the user's team first (by due date), then today's
  news round for their profession. **Shuffle options** and send each with its original `index`; the client
  sends that `index` back as `chosen`, so it never learns which option is best before answering.
  - `PlayRound = { id, type, scenario, question, options: {index, text}[], open_question, pack: { id, title, kind: 'assigned'|'news', due_date } }`
  - `RoundsResponse = { rounds: PlayRound[], assigned: { pack_id, title, due_date, total, done }[] }` — `assigned` feeds the home screen.
- **Answer:** `AnswerResponse = { correct, second_best_pick, best, second_best, why, source_quote, source_location, source_title, source_url, open: OpenGrade|null, points, points_total, repeat }`
  - `source_title` = the document title for company packs (UI shows "From: {source_title}, {source_location}"), or the publication for news.
  - `open` is the §5.4 grade when `open_text` was sent for an `ai_move` question:
    `{ rubric: { task_fit, context, verification, human_line, data_care } (0–2 each), total (0–10), stronger_answer, missed_check|null }`.
- **Finish** (spec §4 has "Finish a ride +5" but no endpoint): awards the ride bonus, the pack-before-due-date
  bonus and the 5-day streak bonus. `FinishResponse = { bonus_points, bonus_reasons: string[], points_total, streak_days }`.

**Points (spec §4):** correct 10 · second-best 5 (Mid/Leader only) · open answer `round(total / 2)` max 5 ·
finish a ride 5 · assigned pack finished before the due date 20 · 5-day streak 15. Only the first attempt
at a question scores; at most 200 points a day.

## Rewards

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/rewards` | `?user_id` (optional) | `{ balance, rewards: Reward[] }` — without `user_id` (LMS catalogue), `balance` is 0 |
| POST | `/api/rewards/:id/redeem` | `{ user_id }` | `{ code, balance, reward }` — code like `UPS-7K2Q`; 400 if short of points, 409 if out of stock |
| POST | `/api/rewards` **addition** | `Reward` without `id` | `Reward` (LMS catalogue management) |
| PATCH | `/api/rewards/:id` **addition** | partial `Reward` | `Reward` |
| DELETE | `/api/rewards/:id` **addition** | — | 204 |
| GET | `/api/redemptions` **addition** | — | `Redemption[]` (LMS history, newest first) |

- `Reward = { id, title, kind: 'sponsor'|'skill_upgrade'|'company', cost_points, sponsor_name|null, stock }`.
  Sponsor rewards use `sponsor_name: "Demo partner"` until real partners sign.
- `Redemption = { id, user_name, team, reward_title, cost_points, code, created_at }`

## Dashboard

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/dashboard` | `?company_id` | `Dashboard` |

```
Dashboard = {
  tiles: { active_players, sessions_completed, avg_score, points_earned }   // each { value, previous } — this week vs last week
  score_by_team: { team, score, answers }[]                                 // score = % correct
  score_by_pack: { pack_id, title, score, answers }[]
  weakest:      { question_id, question, pack_title, miss_rate, answers }[] // most-missed first, max 5
  leaderboard:  { user_id, name, team, points }[]                           // top 10, excluding players who opted out
  completion:   { assignment_id, pack_title, team, due_date, done, in_progress, not_started }[]
}
```

## Running the UI against the backend

- `npm run dev` proxies `/api` to `http://localhost:8080` (override with `API_TARGET=… npm run dev`).
- `npm run dev:mock` runs the UI with the browser-side mock instead; no backend needed.
- `npm run dev:hybrid` mocks everything except what upshift-backend can already do: "Generate pack" for a PDF
  calls `POST /api/admin/documents/questions` (needs `VITE_ADMIN_KEY` in `upshift-ui/.env.local`, matching
  `ADMIN_API_KEY` in `upshift-backend/.env`), and the phone's news rounds use `POST /api/questions/generate` + `/evaluate`.
