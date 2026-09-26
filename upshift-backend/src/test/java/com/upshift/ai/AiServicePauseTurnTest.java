package com.upshift.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.upshift.ai.AiService.Reply;
import com.upshift.ai.ChatModels.MessagesRequest;
import com.upshift.ai.ChatModels.MessagesResponse;
import com.upshift.common.UpstreamException;
import io.quarkus.test.junit.QuarkusMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** AiService against a fake Anthropic API: web search tool definition and pause_turn continuation. */
@QuarkusTest
class AiServicePauseTurnTest {

    record Answer(String answer) {
    }

    static final ObjectMapper MAPPER = new ObjectMapper();
    static final Deque<MessagesResponse> replies = new ArrayDeque<>();
    static final List<MessagesRequest> requests = new ArrayList<>();

    static class FakeClient implements AiApiClient {
        @Override
        public MessagesResponse messages(String apiKey, String anthropicVersion, MessagesRequest request) {
            requests.add(request);
            return replies.poll();
        }
    }

    @Inject
    AiService ai;

    static MessagesResponse reply(String stopReason, int searches, String... blocks) {
        List<JsonNode> content = new ArrayList<>();
        try {
            for (String b : blocks) {
                content.add(MAPPER.readTree(b));
            }
            JsonNode usage = MAPPER.readTree("{\"server_tool_use\":{\"web_search_requests\":" + searches + "}}");
            return new MessagesResponse(content, stopReason, usage);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    static final String SEARCH = "{\"type\":\"server_tool_use\",\"id\":\"srv_1\",\"name\":\"web_search\",\"input\":{\"query\":\"q\"}}";
    static final String RESULTS = "{\"type\":\"web_search_tool_result\",\"tool_use_id\":\"srv_1\",\"content\":["
            + "{\"type\":\"web_search_result\",\"url\":\"https://a.example\",\"title\":\"A\",\"encrypted_content\":\"enc\"}]}";

    @BeforeEach
    void setUp() {
        replies.clear();
        requests.clear();
        QuarkusMock.installMockForType(new FakeClient(), AiApiClient.class, RestClient.LITERAL);
    }

    @Test
    void sendsWebSearchToolOnlyWhenRequested() {
        replies.add(reply("end_turn", 0, "{\"type\":\"text\",\"text\":\"{\\\"answer\\\":\\\"x\\\"}\"}"));
        ai.ask("sys", "user", Answer.class, false);
        assertNull(requests.get(0).tools());

        replies.add(reply("end_turn", 1, SEARCH, RESULTS, "{\"type\":\"text\",\"text\":\"{\\\"answer\\\":\\\"x\\\"}\"}"));
        ai.ask("sys", "user", Answer.class, true);
        Map<String, Object> tool = requests.get(1).tools().get(0);
        assertEquals("web_search_20250305", tool.get("type"));
        assertEquals("web_search", tool.get("name"));
        assertEquals(3, tool.get("max_uses"));
    }

    @Test
    void resumesPausedTurnWithContentSentBackUnchanged() throws Exception {
        replies.add(reply("pause_turn", 1, SEARCH, RESULTS));
        replies.add(reply("end_turn", 1, "{\"type\":\"text\",\"text\":\"{\\\"answer\\\":\\\"done\\\"}\"}"));

        Reply<Answer> r = ai.ask("sys", "user", Answer.class, true);

        assertEquals("done", r.value().answer());
        assertEquals(2, r.webSearches());
        assertEquals("https://a.example", r.searchResults().get(0).url());

        assertEquals(2, requests.size());
        MessagesRequest second = requests.get(1);
        assertEquals(2, second.messages().size());
        assertEquals("assistant", second.messages().get(1).role());
        // Paused blocks, including encrypted_content, are echoed back exactly.
        assertEquals(MAPPER.readTree("[" + SEARCH + "," + RESULTS + "]"),
                MAPPER.valueToTree(second.messages().get(1).content()));
    }

    @Test
    void parsesJsonAfterProseContainingBraces() {
        replies.add(reply("end_turn", 0,
                "{\"type\":\"text\",\"text\":\"Searched {latest} tools. {\\\"answer\\\":\\\"ok\\\"}\"}"));
        assertEquals("ok", ai.ask("sys", "user", Answer.class, false).value().answer());
    }

    @Test
    void givesUpAfterTooManyPauses() {
        for (int i = 0; i < 5; i++) {
            replies.add(reply("pause_turn", 1, SEARCH, RESULTS));
        }
        UpstreamException e = assertThrows(UpstreamException.class,
                () -> ai.ask("sys", "user", Answer.class, true));
        assertEquals(504, e.status());
        assertEquals(4, requests.size()); // first call + 3 continuations
    }
}
