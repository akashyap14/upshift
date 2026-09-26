package com.upshift.common;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import java.util.List;
import java.util.Map;

/** Landing page so opening http://localhost:8080 in a browser shows what the API offers. */
@Path("/")
@Produces(MediaType.APPLICATION_JSON)
public class RootResource {

    public static final List<String> ENDPOINTS = List.of(
            "POST /api/questions/generate",
            "POST /api/questions/evaluate");

    @GET
    public Map<String, Object> info() {
        return Map.of(
                "service", "upshift-backend",
                "status", "UP",
                "endpoints", ENDPOINTS,
                "docs", "/q/swagger-ui");
    }
}
