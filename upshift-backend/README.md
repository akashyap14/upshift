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

```json
{ "profession": "Software Engineer", "count": 5, "difficulty": "medium" }
```
`count` (1-20, default 5) and `difficulty` (default `medium`) are optional.

Response:
```json
{ "profession": "Software Engineer",
  "questions": [ { "id": 1, "question": "...", "topic": "...", "difficulty": "medium" } ] }
```

### 2. `POST /api/questions/evaluate`

Send the generated questions back with the user's answers:
```json
{ "profession": "Software Engineer",
  "answers": [ { "id": 1, "question": "...", "answer": "user's answer" } ] }
```

Response:
```json
{ "profession": "Software Engineer", "overallScore": 72, "summary": "...",
  "strengths": ["..."], "improvements": ["..."],
  "results": [ { "id": 1, "question": "...", "score": 7, "feedback": "...", "idealAnswer": "..." } ] }
```

Errors: `400` for invalid input, `502` if the AI API fails or returns unparseable output.
