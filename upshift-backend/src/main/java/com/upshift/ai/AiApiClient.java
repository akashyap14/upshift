package com.upshift.ai;

import com.upshift.ai.ChatModels.MessagesRequest;
import com.upshift.ai.ChatModels.MessagesResponse;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

/** REST client for the Anthropic API. Base URL is set via quarkus.rest-client.ai-api.url. */
@RegisterRestClient(configKey = "ai-api")
public interface AiApiClient {

    @POST
    @Path("/v1/messages")
    MessagesResponse messages(
            @HeaderParam("x-api-key") String apiKey,
            @HeaderParam("anthropic-version") String anthropicVersion,
            MessagesRequest request);
}
