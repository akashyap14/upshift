package com.upshift.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.upshift.ai.ChatModels.Message;
import com.upshift.ai.ChatModels.MessagesRequest;
import com.upshift.ai.ChatModels.MessagesResponse;
import com.upshift.ai.ChatModels.Source;
import com.upshift.common.UpstreamException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import java.util.concurrent.TimeoutException;

/** Sends a prompt to Claude (optionally with web search) and parses the JSON it returns. */
@ApplicationScoped
public class AiService {

    private static final Logger LOG = Logger.getLogger(AiService.class);
    private static final String ANTHROPIC_VERSION = "2023-06-01";
    /** How many times to resume a turn the API paused (pause_turn) during long server-side searches. */
    private static final int MAX_CONTINUATIONS = 3;
    private static final int MAX_JSON_CANDIDATES = 20;

    /** Parsed reply plus the web pages that search returned (empty when search wasn't used). */
    public record Reply<T>(T value, List<Source> searchResults, int webSearches) {
    }

    @Inject
    @RestClient
    AiApiClient client;

    @Inject
    ObjectMapper mapper;

    @ConfigProperty(name = "upshift.ai.api-key")
    String apiKey;

    @ConfigProperty(name = "upshift.ai.model")
    String model;

    @ConfigProperty(name = "upshift.ai.max-tokens", defaultValue = "8000")
    int maxTokens;

    @ConfigProperty(name = "upshift.ai.web-search.tool-version", defaultValue = "web_search_20250305")
    String webSearchToolVersion;

    @ConfigProperty(name = "upshift.ai.web-search.max-uses", defaultValue = "3")
    int webSearchMaxUses;

    /** Total time allowed across pause_turn continuations (each call also has the HTTP read timeout). */
    @ConfigProperty(name = "upshift.ai.turn-deadline", defaultValue = "PT150S")
    Duration turnDeadline;

    /**
     * Runs {@code first}; if the AI's output was unusable (502), runs {@code retry} once. Other failures
     * (unreachable, rate-limited, timed out) are rethrown, since retrying immediately won't help.
     */
    public static <T> T withOneRetry(String what, Supplier<T> first, Supplier<T> retry) {
        try {
            return first.get();
        } catch (UpstreamException e) {
            if (e.status() != 502) {
                throw e;
            }
            LOG.warnf("Retrying %s after: %s", what, e.getMessage());
            return retry.get();
        }
    }

    public <T> T askForJson(String systemPrompt, String userPrompt, Class<T> type) {
        return ask(systemPrompt, userPrompt, type, false).value();
    }

    /**
     * @param webSearch give Claude Anthropic's server-side web search tool (runs on Anthropic's side,
     *                  billed per search) so it can use current information
     */
    public <T> Reply<T> ask(String systemPrompt, String userPrompt, Class<T> type, boolean webSearch) {
        List<Map<String, Object>> tools = webSearch ? List.of(webSearchTool()) : null;

        List<JsonNode> pausedContent = new ArrayList<>();
        List<JsonNode> allBlocks = new ArrayList<>();
        int searches = 0;
        MessagesResponse response = null;
        long deadline = System.nanoTime() + turnDeadline.toNanos();
        for (int attempt = 0; attempt <= MAX_CONTINUATIONS; attempt++) {
            if (attempt > 0 && System.nanoTime() > deadline) {
                LOG.warnf("AI turn still paused after %s; giving up", turnDeadline);
                break; // reported as 504 below
            }
            List<Message> messages = pausedContent.isEmpty()
                    ? List.of(Message.user(userPrompt))
                    // Resume a paused turn by sending the assistant content back unchanged.
                    : List.of(Message.user(userPrompt), Message.assistant(List.copyOf(pausedContent)));
            response = call(new MessagesRequest(model, maxTokens, systemPrompt, messages, tools));
            if (response == null || response.content() == null) {
                throw new UpstreamException(502, "The AI service returned an empty response. Please try again.", null);
            }
            allBlocks.addAll(response.content());
            searches += webSearchCount(response.usage());
            if (!"pause_turn".equals(response.stopReason())) {
                break;
            }
            LOG.debugf("AI turn paused (continuation %d)", attempt + 1);
            pausedContent.addAll(response.content());
        }
        if ("pause_turn".equals(response.stopReason())) {
            throw new UpstreamException(504, "The AI service took too long to respond. Please try again.", null);
        }
        if ("max_tokens".equals(response.stopReason())) {
            LOG.warn("AI response was truncated by max_tokens; consider raising upshift.ai.max-tokens");
        }

        List<Source> results = webSearch ? searchResults(allBlocks) : List.of();
        return new Reply<>(parse(finalText(allBlocks), type), results, searches);
    }

    private MessagesResponse call(MessagesRequest request) {
        try {
            return client.messages(apiKey, ANTHROPIC_VERSION, request);
        } catch (WebApplicationException e) {
            int status = e.getResponse().getStatus();
            String body = e.getResponse().hasEntity() ? e.getResponse().readEntity(String.class) : "";
            LOG.errorf("AI API returned %d: %s", status, body);
            throw fromUpstreamStatus(status, e);
        } catch (Exception e) {
            if (hasCause(e, TimeoutException.class)) {
                LOG.error("AI API call timed out", e);
                throw new UpstreamException(504, "The AI service took too long to respond. Please try again.", e);
            }
            LOG.error("AI API call failed", e);
            throw new UpstreamException(503, "Could not reach the AI service. Please try again later.", e);
        }
    }

    private Map<String, Object> webSearchTool() {
        Map<String, Object> tool = new LinkedHashMap<>();
        tool.put("type", webSearchToolVersion);
        tool.put("name", "web_search");
        tool.put("max_uses", webSearchMaxUses);
        return tool;
    }

    private <T> T parse(String text, Class<T> type) {
        String cleaned = stripCodeFences(text).strip();
        if (cleaned.isEmpty()) {
            throw new UpstreamException(502, "The AI service returned an empty response. Please try again.", null);
        }
        for (String candidate : jsonCandidates(cleaned)) {
            try {
                return mapper.readValue(candidate, type);
            } catch (JsonProcessingException e) {
                // The model occasionally drops the final closing brace(s); try with them restored.
                String repaired = closeUnbalancedJson(candidate);
                if (!repaired.equals(candidate)) {
                    try {
                        T value = mapper.readValue(repaired, type);
                        LOG.warn("Repaired AI response with missing closing brackets");
                        return value;
                    } catch (JsonProcessingException ignored) {
                        // try the next candidate
                    }
                }
            }
        }
        LOG.errorf("Could not parse AI response as %s: %s", type.getSimpleName(), cleaned);
        throw new UpstreamException(502, "The AI service returned an unexpected response. Please try again.", null);
    }

    /**
     * Possible JSON objects in the text, most likely first: from the first '{', then from each later
     * '{' (prose before the JSON may itself contain braces, e.g. "Searched {latest} tools. {...}").
     */
    static List<String> jsonCandidates(String text) {
        Set<String> candidates = new LinkedHashSet<>();
        candidates.add(extractJson(text));
        int end = text.lastIndexOf('}');
        for (int start = text.indexOf('{'), tried = 0; start >= 0 && tried < MAX_JSON_CANDIDATES;
             start = text.indexOf('{', start + 1), tried++) {
            candidates.add(end > start ? text.substring(start, end + 1) : text.substring(start));
        }
        return List.copyOf(candidates);
    }

    /**
     * The answer is the text written after the last tool block; text before a search is Claude
     * narrating what it is about to look up.
     */
    static String finalText(List<JsonNode> blocks) {
        int lastTool = -1;
        for (int i = 0; i < blocks.size(); i++) {
            String type = blocks.get(i).path("type").asText();
            if (type.endsWith("tool_use") || type.endsWith("tool_result")) {
                lastTool = i;
            }
        }
        StringBuilder text = new StringBuilder();
        for (int i = lastTool + 1; i < blocks.size(); i++) {
            JsonNode block = blocks.get(i);
            if ("text".equals(block.path("type").asText())) {
                text.append(block.path("text").asText());
            }
        }
        return text.toString();
    }

    /** Drops any prose around the JSON object, e.g. "Here are the questions: {...}". */
    static String extractJson(String text) {
        String trimmed = text.strip();
        if (trimmed.isEmpty() || trimmed.startsWith("{")) {
            return trimmed;
        }
        int start = trimmed.indexOf('{');
        if (start < 0) {
            return trimmed;
        }
        int end = trimmed.lastIndexOf('}');
        return end > start ? trimmed.substring(start, end + 1) : trimmed.substring(start);
    }

    /** Unique pages returned by web search in this turn, in the order they came back. */
    static List<Source> searchResults(List<JsonNode> blocks) {
        Map<String, Source> byUrl = new LinkedHashMap<>();
        for (JsonNode block : blocks) {
            if (!"web_search_tool_result".equals(block.path("type").asText())) {
                continue;
            }
            JsonNode content = block.path("content");
            if (!content.isArray()) {
                // Search errors arrive inside a 200 response; Claude carries on without those results.
                LOG.warnf("Web search failed: %s", content.path("error_code").asText("unknown"));
                continue;
            }
            for (JsonNode result : content) {
                String url = result.path("url").asText("");
                if (!url.isBlank()) {
                    byUrl.putIfAbsent(url, new Source(result.path("title").asText(url), url));
                }
            }
        }
        return List.copyOf(byUrl.values());
    }

    private static int webSearchCount(JsonNode usage) {
        return usage == null ? 0 : usage.path("server_tool_use").path("web_search_requests").asInt(0);
    }

    /** Appends any closing brackets/braces left open at the end of {@code json} (ignoring ones inside strings). */
    static String closeUnbalancedJson(String json) {
        Deque<Character> open = new ArrayDeque<>();
        boolean inString = false;
        boolean escaped = false;
        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (c == '\\') {
                    escaped = true;
                } else if (c == '"') {
                    inString = false;
                }
                continue;
            }
            switch (c) {
                case '"' -> inString = true;
                case '{' -> open.push('}');
                case '[' -> open.push(']');
                case '}', ']' -> {
                    if (open.isEmpty() || open.pop() != c) {
                        return json; // mismatched, not a simple truncation; leave it alone
                    }
                }
                default -> {
                }
            }
        }
        if (inString || open.isEmpty()) {
            return json;
        }
        StringBuilder sb = new StringBuilder(json);
        while (!open.isEmpty()) {
            sb.append(open.pop());
        }
        return sb.toString();
    }

    private static UpstreamException fromUpstreamStatus(int status, Throwable cause) {
        return switch (status) {
            case 401, 403 -> new UpstreamException(502,
                    "The AI service rejected our credentials. Please contact support.", cause);
            case 429 -> new UpstreamException(503,
                    "The AI service is busy right now. Please try again in a moment.", cause);
            case 500, 502, 503, 504, 529 -> new UpstreamException(503,
                    "The AI service is temporarily unavailable. Please try again later.", cause);
            default -> new UpstreamException(502,
                    "The AI service could not process the request. Please try again.", cause);
        };
    }

    private static boolean hasCause(Throwable e, Class<? extends Throwable> type) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (type.isInstance(t) || t.getClass().getSimpleName().contains("Timeout")) {
                return true;
            }
        }
        return false;
    }

    /** Models often wrap JSON in markdown code fences; remove them. */
    static String stripCodeFences(String content) {
        if (content == null) {
            return "";
        }
        String trimmed = content.strip();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            int lastFence = trimmed.lastIndexOf("```");
            if (firstNewline > 0 && lastFence > firstNewline) {
                trimmed = trimmed.substring(firstNewline + 1, lastFence).strip();
            }
        }
        return trimmed;
    }
}
