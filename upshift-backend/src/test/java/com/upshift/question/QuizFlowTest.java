package com.upshift.question;

import com.upshift.ai.AiService;
import com.upshift.ai.AiService.Reply;
import com.upshift.ai.ChatModels.Source;
import com.upshift.common.UpstreamException;
import com.upshift.question.QuestionModels.AiGenerateResult;
import com.upshift.question.QuestionModels.AiQuestion;
import io.quarkus.test.junit.QuarkusMock;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** End-to-end generate -> evaluate flow with the AI replaced by a fixed fake. */
@QuarkusTest
class QuizFlowTest {

    /** Correct option text for each fake question, keyed by the id the server assigns (1..n). */
    private static final Map<Integer, String> CORRECT_TEXT = Map.of(
            1, "O(log n)",
            2, "HAVING",
            3, "Git");

    private static final AiGenerateResult GOOD = new AiGenerateResult(null, null, List.of(
            new AiQuestion("Binary search complexity?", List.of("O(log n)", "O(n)", "O(1)", "O(n^2)"), 0,
                    "Halves each step.", "Algorithms", "medium", List.of("https://example.com/big-o")),
            // Invalid: only 3 options, must be dropped.
            new AiQuestion("Broken?", List.of("x", "y", "z"), 0, "n/a", "Bad", "medium", null),
            new AiQuestion("Filter aggregates with?", List.of("WHERE", "HAVING", "ORDER BY", "GROUP BY"), 1,
                    "HAVING filters groups.", "SQL", "medium",
                    // The made-up URL wasn't in the search results, so it must never be shown.
                    List.of("https://made-up.example/not-a-result", "https://example.com/having")),
            // Invalid: duplicate options, must be dropped.
            new AiQuestion("Dupes?", List.of("a", "a", "b", "c"), 2, "n/a", "Bad", "medium", null),
            new AiQuestion("Version control tool?", List.of("Make", "Git", "Docker", "Bash"), 1,
                    "Git tracks changes.", "Tools", "medium", null)));

    static AiGenerateResult nextResult = GOOD;
    /** Scripted replies consumed first: an AiGenerateResult to return or a RuntimeException to throw. */
    static final Deque<Object> script = new ArrayDeque<>();
    static final AtomicInteger calls = new AtomicInteger();
    /** What the last call asked for, so tests can check web search was requested (or not). */
    static volatile boolean lastWebSearch;
    static volatile String lastSystemPrompt;
    /** Pages the fake "web search" returns when search is requested. */
    static final List<Source> SEARCH_RESULTS = List.of(
            new Source("Big-O cheat sheet", "https://example.com/big-o"),
            new Source("SQL HAVING explained", "https://example.com/having"),
            new Source("Git handbook", "https://example.com/git"));

    static class FakeAi extends AiService {
        @Override
        public <T> Reply<T> ask(String systemPrompt, String userPrompt, Class<T> type, boolean webSearch) {
            calls.incrementAndGet();
            lastWebSearch = webSearch;
            lastSystemPrompt = systemPrompt;
            Object next = script.isEmpty() ? nextResult : script.poll();
            if (next instanceof RuntimeException e) {
                throw e;
            }
            return webSearch
                    ? new Reply<>(type.cast(next), SEARCH_RESULTS, 2)
                    : new Reply<>(type.cast(next), List.of(), 0);
        }
    }

    @BeforeEach
    void installFakeAi() {
        nextResult = GOOD;
        script.clear();
        calls.set(0);
        lastWebSearch = false;
        lastSystemPrompt = null;
        QuarkusMock.installMockForType(new FakeAi(), AiService.class);
    }

    private JsonPath generate(int count) {
        return given().contentType(ContentType.JSON)
                .body("{\"profession\":\"Software Engineer\",\"count\":" + count + "}")
                .when().post("/api/questions/generate")
                .then().statusCode(200)
                .extract().jsonPath();
    }

    /** Maps questionId -> option id holding the correct text, as the UI can't know it. */
    private static Map<Integer, String> correctOptionIds(JsonPath quiz) {
        Map<Integer, String> result = new HashMap<>();
        List<Map<String, Object>> questions = quiz.getList("questions");
        for (Map<String, Object> q : questions) {
            int id = (Integer) q.get("id");
            @SuppressWarnings("unchecked")
            List<Map<String, String>> options = (List<Map<String, String>>) q.get("options");
            options.stream().filter(o -> o.get("text").equals(CORRECT_TEXT.get(id)))
                    .findFirst().ifPresent(o -> result.put(id, o.get("id")));
        }
        return result;
    }

    private static String wrongOption(String correct) {
        return correct.equals("A") ? "B" : "A";
    }

    private static io.restassured.response.ValidatableResponse submit(String body) {
        return given().contentType(ContentType.JSON).body(body)
                .when().post("/api/questions/evaluate")
                .then();
    }

    @Test
    void generateReturnsMcqsWithoutAnswers() {
        String raw = given().contentType(ContentType.JSON)
                .body("{\"profession\":\"Software Engineer\",\"count\":5}")
                .when().post("/api/questions/generate")
                .then().statusCode(200)
                .body("quizId", notNullValue())
                .body("expiresAt", notNullValue())
                .body("count", is(3))                      // 2 invalid questions dropped
                .body("questions.id", is(List.of(1, 2, 3)))
                .body("questions.options", everyItem(hasSize(4)))
                .body("questions[0].options.id", is(List.of("A", "B", "C", "D")))
                .extract().asString();

        // The answer key must never reach the UI before submission.
        assertFalse(raw.contains("correctAnswer"), raw);
        assertFalse(raw.contains("correctIndex"), raw);
        assertFalse(raw.contains("explanation"), raw);
        assertFalse(raw.contains("Halves each step"), raw);
    }

    @Test
    void countCapsNumberOfQuestions() {
        generate(2);
        given().contentType(ContentType.JSON).body("{\"profession\":\"Chef\",\"count\":2}")
                .when().post("/api/questions/generate")
                .then().statusCode(200).body("count", is(2)).body("questions", hasSize(2));
    }

    @Test
    void allCorrectScores100AndRevealsAnswers() {
        JsonPath quiz = generate(5);
        Map<Integer, String> correct = correctOptionIds(quiz);
        assertEquals(3, correct.size());

        submit("""
                {"quizId":"%s","answers":[
                  {"questionId":1,"selectedOption":"%s"},
                  {"questionId":2,"selectedOption":"%s"},
                  {"questionId":3,"selectedOption":"%s"}]}
                """.formatted(quiz.getString("quizId"), correct.get(1), correct.get(2), correct.get(3)))
                .statusCode(200)
                .body("profession", is("Software Engineer"))
                .body("totalQuestions", is(3))
                .body("answered", is(3))
                .body("correct", is(3))
                .body("scorePercent", is(100))
                .body("results.correct", everyItem(is(true)))
                .body("results[0].correctAnswer", is(correct.get(1)))
                .body("results[0].explanation", is("Halves each step."))
                .body("results[0].options", hasSize(4));
    }

    @Test
    void mixedAndUnansweredAreScoredAndLowercaseAccepted() {
        JsonPath quiz = generate(5);
        Map<Integer, String> correct = correctOptionIds(quiz);

        // Q1 correct (lower-case), Q2 wrong, Q3 unanswered -> 1/3 = 33%.
        submit("""
                {"quizId":"%s","answers":[
                  {"questionId":1,"selectedOption":"%s"},
                  {"questionId":2,"selectedOption":"%s"}]}
                """.formatted(quiz.getString("quizId"), correct.get(1).toLowerCase(), wrongOption(correct.get(2))))
                .statusCode(200)
                .body("answered", is(2))
                .body("correct", is(1))
                .body("scorePercent", is(33))
                .body("results.correct", is(List.of(true, false, false)))
                .body("results[0].selectedOption", is(correct.get(1)))
                .body("results[2].selectedOption", is((Object) null));
    }

    @Test
    void emptyAnswersScoresZero() {
        JsonPath quiz = generate(5);
        submit("{\"quizId\":\"%s\",\"answers\":[]}".formatted(quiz.getString("quizId")))
                .statusCode(200).body("answered", is(0)).body("scorePercent", is(0));
    }

    @Test
    void quizCanOnlyBeSubmittedOnce() {
        JsonPath quiz = generate(5);
        String body = "{\"quizId\":\"%s\",\"answers\":[{\"questionId\":1,\"selectedOption\":\"A\"}]}"
                .formatted(quiz.getString("quizId"));
        submit(body).statusCode(200);
        submit(body).statusCode(409).body("message", containsString("already been submitted"));
    }

    @Test
    void unknownQuizIs404() {
        submit("{\"quizId\":\"00000000-0000-0000-0000-000000000000\",\"answers\":[]}")
                .statusCode(404).body("message", containsString("not found or expired"));
    }

    @Test
    void invalidSubmissionIs400AndDoesNotBurnQuiz() {
        JsonPath quiz = generate(5);
        String id = quiz.getString("quizId");

        submit("""
                {"quizId":"%s","answers":[
                  {"questionId":99,"selectedOption":"A"},
                  {"questionId":1,"selectedOption":"A"},
                  {"questionId":1,"selectedOption":"B"}]}
                """.formatted(id))
                .statusCode(400)
                .body("details", hasItem("questionId 99 is not part of this quiz"))
                .body("details", hasItem("questionId 1 is answered more than once"));

        // The quiz is still usable after a rejected submission.
        submit("{\"quizId\":\"%s\",\"answers\":[{\"questionId\":1,\"selectedOption\":\"A\"}]}".formatted(id))
                .statusCode(200);
    }

    @Test
    void requestValidation() {
        JsonPath quiz = generate(5);
        String id = quiz.getString("quizId");

        submit("{\"quizId\":\"%s\",\"answers\":[{\"questionId\":1,\"selectedOption\":\"E\"}]}".formatted(id))
                .statusCode(400).body("details", hasItem("answers[0].selectedOption: must be one of: A, B, C, D"));
        submit("{\"quizId\":\"%s\",\"answers\":[{\"questionId\":1}]}".formatted(id))
                .statusCode(400);
        submit("{\"quizId\":\"%s\",\"answers\":[{\"questionId\":0,\"selectedOption\":\"A\"}]}".formatted(id))
                .statusCode(400);
        submit("{\"quizId\":\"%s\"}".formatted(id))
                .statusCode(400).body("details", hasItem("answers: must not be null"));
        submit("{\"quizId\":\"not-a-uuid\",\"answers\":[]}")
                .statusCode(400).body("details", hasItem(containsString("quizId")));
        submit("{\"answers\":[]}").statusCode(400);
    }

    @Test
    void invalidProfessionIs422() {
        nextResult = new AiGenerateResult("INVALID_PROFESSION", "Not a job.", null);
        given().contentType(ContentType.JSON).body("{\"profession\":\"asdfgh\"}")
                .when().post("/api/questions/generate")
                .then().statusCode(422).body("message", containsString("Not a job."));
    }

    @Test
    void noValidMcqsIs502() {
        nextResult = new AiGenerateResult(null, null, List.of(
                new AiQuestion("Broken?", List.of("x", "y"), 0, "n/a", "Bad", "medium", null),
                new AiQuestion("Bad index?", List.of("a", "b", "c", "d"), 7, "n/a", "Bad", "medium", null)));
        given().contentType(ContentType.JSON).body("{\"profession\":\"Chef\"}")
                .when().post("/api/questions/generate")
                .then().statusCode(502).body("message", not(containsString("index")));
    }

    @Test
    void retriesOnceWhenAiOutputIsUnusable() {
        script.add(new UpstreamException(502, "The AI service returned an unexpected response.", null));
        given().contentType(ContentType.JSON).body("{\"profession\":\"Chef\"}")
                .when().post("/api/questions/generate")
                .then().statusCode(200).body("count", is(3));
        assertEquals(2, calls.get());
    }

    @Test
    void givesUpAfterSecondUnusableReply() {
        AiGenerateResult empty = new AiGenerateResult(null, null, List.of());
        script.add(empty);
        script.add(empty);
        given().contentType(ContentType.JSON).body("{\"profession\":\"Chef\"}")
                .when().post("/api/questions/generate")
                .then().statusCode(502);
        assertEquals(2, calls.get());
    }

    @Test
    void doesNotRetryWhenAiIsUnavailable() {
        script.add(new UpstreamException(503, "The AI service is busy right now.", null));
        given().contentType(ContentType.JSON).body("{\"profession\":\"Chef\"}")
                .when().post("/api/questions/generate")
                .then().statusCode(503);
        assertEquals(1, calls.get());
    }

    @Test
    void retryAfterUnusableOutputDoesNotSearchTheWebAgain() {
        script.add(new UpstreamException(502, "The AI service returned an unexpected response.", null));
        given().contentType(ContentType.JSON).body("{\"profession\":\"Chef\",\"webSearch\":true}")
                .when().post("/api/questions/generate")
                .then().statusCode(200)
                .body("webSearch", is(false))
                .body("sources", hasSize(0));
        assertEquals(2, calls.get());
        assertFalse(lastWebSearch); // the retry ran without the (billed) search tool
    }

    @Test
    void webSearchIsOffByDefault() {
        given().contentType(ContentType.JSON).body("{\"profession\":\"Chef\"}")
                .when().post("/api/questions/generate")
                .then().statusCode(200)
                .body("webSearch", is(false))
                .body("sources", hasSize(0));
        assertFalse(lastWebSearch);
        assertFalse(lastSystemPrompt.contains("web_search"));
    }

    @Test
    void webSearchReturnsOnlyRealCitedSources() {
        String quizId = given().contentType(ContentType.JSON)
                .body("{\"profession\":\"Software Engineer\",\"webSearch\":true}")
                .when().post("/api/questions/generate")
                .then().statusCode(200)
                .body("webSearch", is(true))
                .body("sources.url", is(List.of("https://example.com/big-o", "https://example.com/having")))
                .body("sources[0].title", is("Big-O cheat sheet"))
                .extract().path("quizId");
        assertTrue(lastWebSearch);
        assertTrue(lastSystemPrompt.contains("web_search"));

        // The same sources come back with the graded results.
        submit("{\"quizId\":\"%s\",\"answers\":[]}".formatted(quizId))
                .statusCode(200)
                .body("sources.url", hasItem("https://example.com/having"));
    }

    @Test
    void webSearchFallsBackToTopResultsWhenNothingCited() {
        nextResult = new AiGenerateResult(null, null, List.of(
                new AiQuestion("Version control tool?", List.of("Make", "Git", "Docker", "Bash"), 1,
                        "Git tracks changes.", "Tools", "medium", List.of())));
        given().contentType(ContentType.JSON).body("{\"profession\":\"Chef\",\"webSearch\":true}")
                .when().post("/api/questions/generate")
                .then().statusCode(200)
                .body("sources", hasSize(3));
    }

    @Test
    void webSearchSourcesAreNotLeakedAsAnswers() {
        String raw = given().contentType(ContentType.JSON)
                .body("{\"profession\":\"Software Engineer\",\"webSearch\":true}")
                .when().post("/api/questions/generate")
                .then().statusCode(200).extract().asString();
        assertFalse(raw.contains("correctAnswer"), raw);
        assertFalse(raw.contains("made-up.example"), raw);
    }
}
