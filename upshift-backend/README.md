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
{ "profession": "Software Engineer", "count": 5, "difficulty": "medium" }
```
`count` (1-20, default 5) and `difficulty` (`easy` | `medium` | `hard`, default `medium`) are optional.

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
