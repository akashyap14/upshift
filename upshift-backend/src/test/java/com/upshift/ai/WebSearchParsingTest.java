package com.upshift.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.upshift.ai.ChatModels.Source;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Response shapes follow the web search tool docs (server_tool_use / web_search_tool_result blocks). */
class WebSearchParsingTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static List<JsonNode> blocks(String... json) {
        List<JsonNode> list = new ArrayList<>();
        for (String j : json) {
            try {
                list.add(MAPPER.readTree(j));
            } catch (Exception e) {
                throw new IllegalArgumentException(j, e);
            }
        }
        return list;
    }

    private static final String NARRATION = "{\"type\":\"text\",\"text\":\"I'll search for {current} tools.\"}";
    private static final String TOOL_USE = "{\"type\":\"server_tool_use\",\"id\":\"srv_1\",\"name\":\"web_search\","
            + "\"input\":{\"query\":\"ai tools\"}}";
    private static final String RESULTS = "{\"type\":\"web_search_tool_result\",\"tool_use_id\":\"srv_1\",\"content\":["
            + "{\"type\":\"web_search_result\",\"url\":\"https://a.example\",\"title\":\"A\",\"encrypted_content\":\"x\"},"
            + "{\"type\":\"web_search_result\",\"url\":\"https://b.example\",\"title\":\"B\",\"encrypted_content\":\"y\"}]}";
    private static final String RESULTS_AGAIN = "{\"type\":\"web_search_tool_result\",\"tool_use_id\":\"srv_2\",\"content\":["
            + "{\"type\":\"web_search_result\",\"url\":\"https://b.example\",\"title\":\"B\",\"encrypted_content\":\"y\"},"
            + "{\"type\":\"web_search_result\",\"url\":\"https://c.example\",\"encrypted_content\":\"z\"}]}";
    private static final String ERROR = "{\"type\":\"web_search_tool_result\",\"tool_use_id\":\"srv_3\","
            + "\"content\":{\"type\":\"web_search_tool_result_error\",\"error_code\":\"max_uses_exceeded\"}}";

    @Test
    void finalTextIgnoresNarrationBeforeSearch() {
        List<JsonNode> b = blocks(NARRATION, TOOL_USE, RESULTS,
                "{\"type\":\"thinking\",\"thinking\":\"...\"}",
                "{\"type\":\"text\",\"text\":\"{\\\"questions\\\": \"}",
                "{\"type\":\"text\",\"text\":\"[]}\",\"citations\":[]}");
        assertEquals("{\"questions\": []}", AiService.finalText(b));
    }

    @Test
    void finalTextWithoutToolsIsAllText() {
        List<JsonNode> b = blocks("{\"type\":\"text\",\"text\":\"{\\\"a\\\":1}\"}");
        assertEquals("{\"a\":1}", AiService.finalText(b));
    }

    @Test
    void extractJsonDropsSurroundingProse() {
        assertEquals("{\"a\":1}", AiService.extractJson("Here you go: {\"a\":1} Hope that helps."));
        assertEquals("{\"a\":1}", AiService.extractJson("  {\"a\":1}  "));
        assertEquals("{\"a\":[1", AiService.extractJson("Result: {\"a\":[1"));
        assertEquals("no json", AiService.extractJson("no json"));
    }

    @Test
    void jsonCandidatesSkipBracesInLeadingProse() {
        List<String> c = AiService.jsonCandidates("Searched {latest} tools. {\"a\":1}");
        assertEquals("{latest} tools. {\"a\":1}", c.get(0)); // first guess fails to parse...
        assertEquals(true, c.contains("{\"a\":1}"));        // ...so a later '{' is tried
    }

    @Test
    void searchResultsAreDedupedAndErrorsSkipped() {
        List<Source> sources = AiService.searchResults(blocks(TOOL_USE, RESULTS, ERROR, RESULTS_AGAIN));
        assertEquals(List.of(
                new Source("A", "https://a.example"),
                new Source("B", "https://b.example"),
                new Source("https://c.example", "https://c.example")), sources);
    }

    @Test
    void noSearchBlocksMeansNoSources() {
        assertEquals(List.of(), AiService.searchResults(blocks(NARRATION)));
    }
}
