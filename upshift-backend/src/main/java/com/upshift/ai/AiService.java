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
import java.util.concurrent.TimeoutException;
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

        if (response == null || response.content() == null || response.content().isEmpty()) {
            throw new UpstreamException(502, "The AI service returned an empty response. Please try again.", null);
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
            throw new UpstreamException(502, "The AI service returned an unexpected response. Please try again.", e);
        }
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
