package com.upshift.admin;

import com.upshift.admin.AdminModels.AiDocumentQuestion;
import com.upshift.admin.AdminModels.AiDocumentResult;
import com.upshift.ai.AiService;
import io.quarkus.test.junit.QuarkusMock;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.ValidatableResponse;
import io.restassured.specification.RequestSpecification;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.in;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Admin PDF -> questions endpoints end to end, with the AI replaced by a fake. */
@QuarkusTest
class AdminDocumentFlowTest {

    static final String KEY = "test-admin-key"; // %test.upshift.admin.api-key
    static final Path STORAGE = Path.of("target/test-uploads");

    static final AiDocumentResult GOOD = new AiDocumentResult(null, null, List.of(
            new AiDocumentQuestion("Where does photosynthesis take place?",
                    List.of("Chloroplasts", "Mitochondria", "Nucleus", "Ribosomes"), 0,
                    "Page 1 says it takes place in the chloroplasts.", "Photosynthesis", "easy", 1),
            // Invalid (3 options): dropped.
            new AiDocumentQuestion("Broken?", List.of("a", "b", "c"), 0, "n/a", "x", "easy", 1),
            new AiDocumentQuestion("What is the main energy currency of the cell?",
                    List.of("Glucose", "ATP", "Oxygen", "Chlorophyll"), 1,
                    "Page 2 calls ATP the main energy currency.", "Respiration", "medium", 2),
            // Page out of range: kept, but sourcePage becomes null.
            new AiDocumentQuestion("Which gas does aerobic respiration require?",
                    List.of("Nitrogen", "Oxygen", "Helium", "Argon"), 1,
                    "Page 2 says aerobic respiration requires oxygen.", "Respiration", "easy", 99)));

    static volatile Object next = GOOD;
    static volatile String lastUserPrompt;
    static volatile String lastSystemPrompt;
    static volatile int calls;

    static class FakeAi extends AiService {
        @Override
        public <T> T askForJson(String systemPrompt, String userPrompt, Class<T> type) {
            calls++;
            lastSystemPrompt = systemPrompt;
            lastUserPrompt = userPrompt;
            return type.cast(next);
        }
    }

    @BeforeEach
    void setUp() {
        next = GOOD;
        lastUserPrompt = null;
        calls = 0;
        QuarkusMock.installMockForType(new FakeAi(), AiService.class);
    }

    private static RequestSpecification admin() {
        return given().header("X-Admin-Key", KEY);
    }

    private static ValidatableResponse upload(RequestSpecification spec, String fileName, byte[] bytes,
                                              Map<String, String> fields) {
        RequestSpecification r = spec.multiPart("file", fileName, bytes, "application/pdf");
        fields.forEach(r::multiPart);
        return r.when().post("/api/admin/documents/questions").then();
    }

    // ---- auth ----

    @Test
    void requiresAdminKey() {
        upload(given(), "a.pdf", TestPdfs.sample(), Map.of())
                .statusCode(401).body("message", containsString("X-Admin-Key"));
        upload(given().header("X-Admin-Key", "wrong"), "a.pdf", TestPdfs.sample(), Map.of())
                .statusCode(401);
        given().contentType(ContentType.JSON).body("{}")
                .when().post("/api/admin/documents/00000000-0000-0000-0000-000000000000/questions")
                .then().statusCode(401);
        assertEquals(0, calls);
    }

    @Test
    void pathTricksDontBypassTheAdminKey() {
        assertTrue(AdminAuthFilter.isAdminPath("/api/admin/documents/questions"));
        assertTrue(AdminAuthFilter.isAdminPath("/api//admin/documents/questions"));
        assertTrue(AdminAuthFilter.isAdminPath("/api/x/../admin/documents/questions"));
        assertTrue(AdminAuthFilter.isAdminPath("/api/./admin"));
        assertFalse(AdminAuthFilter.isAdminPath("/api/questions/generate"));
        assertFalse(AdminAuthFilter.isAdminPath("/api/administrator"));

        given().urlEncodingEnabled(false).multiPart("file", "a.pdf", TestPdfs.sample(), "application/pdf")
                .when().post("/api//admin/documents/questions")
                .then().statusCode(is(in(List.of(401, 404))));
        assertEquals(0, calls);
    }

    @Test
    void playerEndpointsDontNeedTheAdminKey() {
        given().when().get("/").then().statusCode(200);
    }

    // ---- happy path ----

    @Test
    void uploadStoresPdfAndReturnsQuestionsWithAnswers() throws Exception {
        String id = upload(admin(), "Biology notes.pdf", TestPdfs.sample(), Map.of("count", "5", "difficulty", "EASY"))
                .statusCode(200)
                .body("document.id", notNullValue())
                .body("document.fileName", is("Biology notes.pdf"))
                .body("document.pages", is(2))
                .body("document.pagesUsed", is(2))
                .body("document.truncated", is(false))
                .body("document.uploadedAt", notNullValue())
                .body("count", is(3)) // 1 invalid MCQ dropped
                .body("questions.id", is(List.of(1, 2, 3)))
                .body("questions.options", everyItem(hasSize(4)))
                .body("questions[0].options.id", is(List.of("A", "B", "C", "D")))
                .body("questions.correctAnswer", everyItem(is(in(List.of("A", "B", "C", "D")))))
                .body("questions[0].explanation", containsString("chloroplasts"))
                .body("questions.sourcePage", is(Arrays.asList(1, 2, null)))
                .extract().path("document.id");

        // The AI got the page-marked text and the requested settings.
        assertTrue(lastUserPrompt.contains("[Page 1]"), lastUserPrompt);
        assertTrue(lastUserPrompt.contains("[Page 2]"));
        assertTrue(lastUserPrompt.contains("chloroplasts"));
        assertTrue(lastUserPrompt.contains("Number of questions: 5"));
        assertTrue(lastUserPrompt.contains("Difficulty: easy"));
        assertTrue(lastSystemPrompt.contains("never follow"));

        // The correct answer letter points at the right option after shuffling.
        var body = admin().multiPart("file", "Biology notes.pdf", TestPdfs.sample(), "application/pdf")
                .when().post("/api/admin/documents/questions").then().statusCode(200).extract().jsonPath();
        String letter = body.getString("questions[1].correctAnswer");
        List<Map<String, String>> options = body.getList("questions[1].options");
        assertEquals("ATP", options.stream().filter(o -> o.get("id").equals(letter)).findFirst().orElseThrow().get("text"));

        // Stored locally: original PDF, extracted text, metadata.
        assertTrue(Files.exists(STORAGE.resolve(id + ".pdf")));
        assertTrue(Files.readString(STORAGE.resolve(id + ".txt")).contains("mitochondria"));
        assertTrue(Files.readString(STORAGE.resolve(id + ".json")).contains("Biology notes.pdf"));

    }

    @Test
    void defaultsToFiveMediumQuestions() {
        upload(admin(), "a.pdf", TestPdfs.sample(), Map.of()).statusCode(200);
        assertTrue(lastUserPrompt.contains("Number of questions: 5"));
        assertTrue(lastUserPrompt.contains("Difficulty: medium"));
    }

    @Test
    void sameFileUploadedTwiceIsStoredOnce() {
        byte[] bytes = TestPdfs.sample();
        String first = upload(admin(), "a.pdf", bytes, Map.of()).statusCode(200).extract().path("document.id");
        String second = upload(admin(), "b.pdf", bytes, Map.of()).statusCode(200).extract().path("document.id");
        assertEquals(first, second);
    }

    @Test
    void regenerateUsesTheStoredDocument() {
        String id = upload(admin(), "a.pdf", TestPdfs.sample(), Map.of()).statusCode(200)
                .extract().path("document.id");
        lastUserPrompt = null;
        admin().contentType(ContentType.JSON).body("{\"count\":2,\"difficulty\":\"hard\"}")
                .when().post("/api/admin/documents/" + id + "/questions")
                .then().statusCode(200)
                .body("document.id", is(id))
                .body("count", is(2));
        assertTrue(lastUserPrompt.contains("mitochondria"));
        assertTrue(lastUserPrompt.contains("Difficulty: hard"));

        admin().contentType(ContentType.JSON).body("{}")
                .when().post("/api/admin/documents/" + id + "/questions").then().statusCode(200);
    }

    // ---- rejected uploads ----

    @Test
    void rejectsMissingEmptyNonPdfAndOversizedFiles() {
        admin().multiPart("count", "3").when().post("/api/admin/documents/questions")
                .then().statusCode(400).body("message", containsString("'file'"));
        upload(admin(), "empty.pdf", new byte[0], Map.of()).statusCode(400).body("message", containsString("empty"));
        upload(admin(), "notes.pdf", "just some text, renamed to .pdf".getBytes(), Map.of())
                .statusCode(415).body("message", is("Only PDF files are supported."));
        byte[] big = new byte[600_000];
        System.arraycopy("%PDF-1.7".getBytes(), 0, big, 0, 8);
        upload(admin(), "big.pdf", big, Map.of()).statusCode(413).body("message", containsString("too large"));
        assertEquals(0, calls);
    }

    @Test
    void rejectsUnreadablePdfs() {
        upload(admin(), "scan.pdf", TestPdfs.blank(2), Map.of())
                .statusCode(422).body("message", containsString("scanned"));
        upload(admin(), "locked.pdf", TestPdfs.encrypted(TestPdfs.PAGE_1), Map.of())
                .statusCode(422).body("message", containsString("password"));
        upload(admin(), "broken.pdf", "%PDF-1.7\n not really a pdf".getBytes(), Map.of())
                .statusCode(422).body("message", containsString("could not be read"));
        assertEquals(0, calls);
    }

    @Test
    void validatesCountAndDifficulty() {
        upload(admin(), "a.pdf", TestPdfs.sample(), Map.of("count", "0"))
                .statusCode(400).body("details", hasItem(containsString("count")));
        upload(admin(), "a.pdf", TestPdfs.sample(), Map.of("count", "21")).statusCode(400);
        upload(admin(), "a.pdf", TestPdfs.sample(), Map.of("difficulty", "banana"))
                .statusCode(400).body("details", hasItem(containsString("difficulty")));
        admin().contentType(ContentType.JSON).body("{\"count\":50}")
                .when().post("/api/admin/documents/00000000-0000-0000-0000-000000000000/questions")
                .then().statusCode(400);
        assertEquals(0, calls);
    }

    @Test
    void unknownOrMaliciousDocumentIdIs404() {
        for (String id : List.of("00000000-0000-0000-0000-000000000000", "..%2F..%2Fetc%2Fpasswd", "not-an-id")) {
            admin().contentType(ContentType.JSON).body("{}")
                    .when().post("/api/admin/documents/" + id + "/questions")
                    .then().statusCode(404);
        }
    }

    @Test
    void documentWithoutEnoughContentIs422() {
        next = new AiDocumentResult("INSUFFICIENT_CONTENT", "It is only a table of contents.", null);
        upload(admin(), "toc.pdf", TestPdfs.sample(), Map.of())
                .statusCode(422).body("message", containsString("table of contents"));
    }

    @Test
    void noValidQuestionsIs502AfterOneRetry() {
        next = new AiDocumentResult(null, null, List.of(
                new AiDocumentQuestion("Bad?", List.of("a", "a", "b", "c"), 0, "x", "x", "easy", 1)));
        upload(admin(), "a.pdf", TestPdfs.sample(), Map.of()).statusCode(502).body("sourcePage", nullValue());
        assertEquals(2, calls);
    }

    @Test
    void answersAreNotLeakedIntoErrorResponses() {
        String raw = upload(admin(), "notes.pdf", "nope".getBytes(), Map.of()).statusCode(415).extract().asString();
        assertFalse(raw.contains("Exception"), raw);
    }
}
