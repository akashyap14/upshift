package com.upshift.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.upshift.ai.ChatModels.ContentBlock;
import com.upshift.ai.ChatModels.Message;
import com.upshift.ai.ChatModels.MessagesRequest;
import com.upshift.ai.ChatModels.MessagesResponse;
import com.upshift.common.UpstreamException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

import java.util.List;
import java.util.stream.Collectors;

/** Sends a prompt to Claude and parses the JSON it returns. */
@ApplicationScoped
public class AiService {

    private static final Logger LOG = Logger.getLogger(AiService.class);
    private static final String ANTHROPIC_VERSION = "2023-06-01";

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

    public <T> T askForJson(String systemPrompt, String userPrompt, Class<T> type) {
        MessagesRequest request = new MessagesRequest(
                model,
                maxTokens,
                systemPrompt,
                List.of(Message.user(userPrompt)));

        MessagesResponse response;
        try {
            response = client.messages(apiKey, ANTHROPIC_VERSION, request);
        } catch (WebApplicationException e) {
            String body = e.getResponse().hasEntity() ? e.getResponse().readEntity(String.class) : "";
            LOG.errorf("AI API returned %d: %s", e.getResponse().getStatus(), body);
            throw new UpstreamException("AI API returned " + e.getResponse().getStatus() + ": " + body, e);
        } catch (Exception e) {
            LOG.error("AI API call failed", e);
            throw new UpstreamException("AI API call failed: " + e.getMessage(), e);
        }

        if (response == null || response.content() == null || response.content().isEmpty()) {
            throw new UpstreamException("AI API returned an empty response", null);
        }
        if ("max_tokens".equals(response.stopReason())) {
            LOG.warn("AI response was truncated by max_tokens; consider raising upshift.ai.max-tokens");
        }

        String text = response.content().stream()
                .filter(block -> "text".equals(block.type()))
                .map(ContentBlock::text)
                .collect(Collectors.joining());
        String content = stripCodeFences(text);
        try {
            return mapper.readValue(content, type);
        } catch (JsonProcessingException e) {
            LOG.errorf("Could not parse AI response as %s: %s", type.getSimpleName(), content);
            throw new UpstreamException("AI API returned invalid JSON", e);
        }
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
