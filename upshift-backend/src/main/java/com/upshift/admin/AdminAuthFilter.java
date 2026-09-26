package com.upshift.admin;

import com.upshift.common.ErrorResponse;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;
import org.jboss.resteasy.reactive.server.ServerRequestFilter;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Optional;

/**
 * Protects /api/admin/*: the admin UI must send the configured key in the X-Admin-Key header.
 * If no key is configured the admin API is disabled (fails closed), since uploads spend AI credits.
 */
public class AdminAuthFilter {

    public static final String HEADER = "X-Admin-Key";
    private static final Logger LOG = Logger.getLogger(AdminAuthFilter.class);

    @ConfigProperty(name = "upshift.admin.api-key")
    Optional<String> adminKey;

    /** Pre-matching, so unauthenticated uploads are rejected before their body is read and stored. */
    @ServerRequestFilter(preMatching = true)
    public Optional<Response> checkAdminKey(ContainerRequestContext ctx) {
        if (!isAdminPath(ctx.getUriInfo().getPath())) {
            return Optional.empty();
        }
        String expected = adminKey.map(String::strip).orElse("");
        if (expected.isEmpty()) {
            LOG.warn("Admin request rejected: upshift.admin.api-key (ADMIN_API_KEY) is not set");
            return Optional.of(error(503, "Service Unavailable", "The admin API is not configured."));
        }
        String given = ctx.getHeaderString(HEADER);
        if (given == null || !MessageDigest.isEqual(
                given.strip().getBytes(StandardCharsets.UTF_8), expected.getBytes(StandardCharsets.UTF_8))) {
            return Optional.of(error(401, "Unauthorized", "Missing or invalid " + HEADER + " header."));
        }
        return Optional.empty();
    }

    /**
     * Pre-matching filters see the raw path, so normalise it first: "/api//admin" or "/api/x/../admin"
     * must not slip past the check and still be routed to an admin endpoint.
     */
    static boolean isAdminPath(String rawPath) {
        String path = rawPath == null ? "" : rawPath.replaceAll("/{2,}", "/");
        try {
            path = new URI(null, null, path, null).normalize().getPath();
        } catch (URISyntaxException e) {
            return true; // unparseable: treat as protected
        }
        return path.equals("/api/admin") || path.startsWith("/api/admin/");
    }

    private static Response error(int status, String error, String message) {
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity(new ErrorResponse(status, error, message))
                .build();
    }
}
