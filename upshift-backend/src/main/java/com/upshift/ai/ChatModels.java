package com.upshift.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;

/** Request/response shapes for the Anthropic Messages API (POST /v1/messages). */
public final class ChatModels {

    private ChatModels() {
    }

    /**
     * {@code content} is a String for our prompts, or the raw content blocks of an assistant turn
     * when continuing after {@code pause_turn} (they must be sent back unchanged).
     */
    public record Message(String role, Object content) {
        public static Message user(String content) {
            return new Message("user", content);
        }

        public static Message assistant(List<JsonNode> blocks) {
            return new Message("assistant", blocks);
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record MessagesRequest(
            String model,
            @JsonProperty("max_tokens") int maxTokens,
            String system,
            List<Message> messages,
            List<Map<String, Object>> tools) {
    }

    /** Content is kept as raw JSON: server tool blocks vary by type and must be echoed back verbatim. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MessagesResponse(
            List<JsonNode> content,
            @JsonProperty("stop_reason") String stopReason,
            JsonNode usage) {
    }

    /** A web page the answer drew on; shown to users as a citation. */
    public record Source(String title, String url) {
    }
}
