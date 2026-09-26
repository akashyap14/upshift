# Upshift Backend (Quarkus)

Generates interview questions for a profession and evaluates answers, using the
Anthropic (Claude) Messages API.

## Configure

Copy `.env.example` to `.env` (already done locally) and fill in:

| Variable       | Default                      | Description                        |
|----------------|------------------------------|------------------------------------|
| `AI_API_URL`   | `https://api.anthropic.com`  | Anthropic API base URL             |
| `AI_API_KEY`   | (required)                   | Anthropic API key                  |
| `AI_MODEL`     | `claude-sonnet-5`            | Claude model                       |
| `CORS_ORIGINS` | localhost:3000, 5173, 4200   | Comma-separated allowed UI origins |

Quarkus reads `.env` from the directory you start it in. `.env` is gitignored.

## Run

```powershell
./mvnw quarkus:dev
```

Swagger UI: http://localhost:8080/q/swagger-ui

## Endpoints

### 1. `POST /api/questions/generate`

Generates **multiple-choice (MCQ)** questions for a profession and starts a quiz.

```json
{ "profession": "Software Engineer", "count": 5, "difficulty": "medium", "webSearch": true }
```
`count` (1-20, default 5), `difficulty` (`easy` | `medium` | `hard`, default `medium`) and
`webSearch` (default `false`, see [Web search](#web-search)) are optional.

Response (note: **no correct answers**, they stay on the server):
```json
{ "quizId": "9138e39e-a728-4694-bd3d-ae264efe4eaa",
  "profession": "Software Engineer",
  "count": 5,
  "expiresAt": "2026-09-26T09:44:07Z",
  "questions": [
    { "id": 1,
      "question": "What is the time complexity of binary search on a sorted array?",
      "options": [
        { "id": "A", "text": "O(n log n)" },
        { "id": "B", "text": "O(n)" },
        { "id": "C", "text": "O(log n)" },
        { "id": "D", "text": "O(1)" }
      ],
      "topic": "Algorithms",
      "difficulty": "medium" } ] }
```

Every question has exactly 4 distinct options (A-D) and one correct answer. Options are
shuffled server-side so the correct answer's position is random. Malformed questions from the
AI are dropped, so `count` may occasionally be lower than requested.

#### Web search

Send `"webSearch": true` to let Claude search the web (Anthropic's server-side
[web search tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool))
for current information before writing the questions. The response then has
`"webSearch": true` and `"sources": [{ "title": "...", "url": "..." }]`, the pages the questions
are based on. **Show these sources to the user**; they are also returned by `/evaluate`.
Only URLs that actually came back from the search are listed.

- Slower and costs more: ~16s vs ~8s for 3 questions; $10 per 1,000 searches plus tokens.
  At most `upshift.ai.web-search.max-uses` (3) searches per quiz.
- Off unless requested (`upshift.ai.web-search.default=false`); set `AI_WEB_SEARCH_ENABLED=false`
  to disable it completely.
- Uses `web_search_20250305` (basic). `web_search_20260318` (dynamic filtering) also works via
  `upshift.ai.web-search.tool-version`, but was ~3x slower for this workload.
- Web search must be enabled for your organization in the Claude Console.

### 2. `POST /api/questions/evaluate`

Submit the chosen option for each question. The server grades it and only then reveals the
correct answers and explanations.

```json
{ "quizId": "9138e39e-a728-4694-bd3d-ae264efe4eaa",
  "answers": [
    { "questionId": 1, "selectedOption": "C" },
    { "questionId": 2, "selectedOption": "A" } ] }
```

Response:
```json
{ "quizId": "9138e39e-a728-4694-bd3d-ae264efe4eaa",
  "profession": "Software Engineer",
  "totalQuestions": 5, "answered": 2, "correct": 1, "scorePercent": 20,
  "results": [
    { "questionId": 1, "question": "...", "options": [ ... ],
      "selectedOption": "C", "correctAnswer": "C", "correct": true,
      "explanation": "Binary search halves the search space each step." } ] }
```

Rules:
- Unanswered questions count as incorrect (`selectedOption: null`).
- `selectedOption` is `A`-`D` (case-insensitive).
- A quiz can be submitted **once** (a second submit returns `409`); a rejected (`400`) submit doesn't count.
- Quizzes expire after 2 hours (`upshift.quiz.ttl`). Quizzes are kept in memory, so they are lost on
  restart and not shared across multiple backend instances.

## Admin: questions from a PDF

For the admin panel. Every `/api/admin/*` request needs the header
**`X-Admin-Key: <ADMIN_API_KEY from .env>`**. Without a configured key the admin API is disabled (`503`).

### `POST /api/admin/documents/questions` (multipart/form-data)

| Field        | Required | Notes |
|--------------|----------|-------|
| `file`       | yes      | A text-based PDF, max 10 MB / 300 pages |
| `count`      | no       | 1-20, default 5 |
| `difficulty` | no       | `easy` \| `medium` \| `hard`, default `medium` |

```js
const form = new FormData()
form.append('file', fileInput.files[0])
form.append('count', '5')
const res = await fetch('http://localhost:8080/api/admin/documents/questions', {
  method: 'POST',
  headers: { 'X-Admin-Key': adminKey }, // don't set Content-Type; the browser adds the boundary
  body: form,
})
```

The server stores the PDF locally, extracts its text with Apache PDFBox, and asks Claude for MCQs
based **only** on the document. Response (admins see the answers):

```json
{ "document": { "id": "ed99ec9e-...", "fileName": "policy.pdf", "sizeBytes": 52239, "pages": 3,
                "characters": 1720, "uploadedAt": "2026-09-26T10:10:00Z", "pagesUsed": 3, "truncated": false },
  "count": 5,
  "questions": [
    { "id": 1,
      "question": "What is the minimum passphrase length?",
      "options": [ { "id": "A", "text": "8 characters" }, { "id": "B", "text": "12 characters" },
                   { "id": "C", "text": "16 characters" }, { "id": "D", "text": "20 characters" } ],
      "correctAnswer": "C",
      "explanation": "The document states passphrases must be at least 16 characters.",
      "topic": "Passwords", "difficulty": "easy",
      "sourcePage": 1 } ] }
```

- `sourcePage` is the PDF page the answer comes from (`null` if the AI's page wasn't valid).
- Long PDFs: about the first 120,000 characters are used (`pagesUsed`, `truncated: true`).
- Uploading the same file again reuses the stored document (same `id`).
- Instructions inside a PDF are treated as content, not followed.

### `POST /api/admin/documents/{id}/questions` (JSON)

New questions from an already uploaded document: `{ "count": 3, "difficulty": "hard" }` (both optional).
Same response shape. Unknown id → `404`.

### Storage

Files go to `data/uploads/` (`ADMIN_STORAGE_DIR` to change; gitignored): `<id>.pdf` (original),
`<id>.txt` (extracted text) and `<id>.json` (metadata). File names from uploads are never used as paths.

### Admin errors

| Status | When |
|--------|------|
| `400`  | No `file` field, empty file, invalid `count`/`difficulty` |
| `401`  | Missing or wrong `X-Admin-Key` |
| `413`  | PDF over 10 MB |
| `415`  | Not a PDF (checked by content, not file name) |
| `422`  | Password-protected, damaged, scanned (no selectable text), over 300 pages, or not enough content for questions |
| `502` / `503` / `504` | AI failures, as for the player API |

## Errors

Every error returns the same JSON shape, so the UI can always show `message`:

```json
{ "status": 400, "error": "Bad Request", "message": "Invalid request",
  "details": ["profession: must not be blank"] }
```

| Status | When |
|--------|------|
| `400`  | Missing/invalid fields (`details` lists each problem), malformed JSON, wrong field types, unknown or duplicate `questionId` |
| `404` / `405` / `415` | Unknown endpoint, wrong HTTP method, Content-Type not `application/json` |
| `404`  | `quizId` unknown or expired |
| `409`  | Quiz already submitted |
| `422`  | Profession isn't a real job title (gibberish or prompt-injection attempts) |
| `502`  | AI returned unusable output, or the API key was rejected |
| `503`  | AI service unreachable, rate-limited or overloaded; safe to retry |
| `504`  | AI service timed out; safe to retry |
| `500`  | Unexpected server error |

Upstream error details are logged server-side and never sent to the UI.
