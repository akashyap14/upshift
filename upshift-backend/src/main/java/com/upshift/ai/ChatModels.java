package com.upshift.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/** Request/response shapes for the Anthropic Messages API (POST /v1/messages). */
public final class ChatModels {

    private ChatModels() {
    }

    public record Message(String role, String content) {
        public static Message user(String content) {
            return new Message("user", content);
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record MessagesRequest(
            String model,
            @JsonProperty("max_tokens") int maxTokens,
            String system,
            List<Message> messages) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MessagesResponse(List<ContentBlock> content, @JsonProperty("stop_reason") String stopReason) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ContentBlock(String type, String text) {
    }
}
