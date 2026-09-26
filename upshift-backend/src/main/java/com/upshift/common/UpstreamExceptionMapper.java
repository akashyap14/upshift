package com.upshift.common;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

@Provider
public class UpstreamExceptionMapper implements ExceptionMapper<UpstreamException> {

    @Override
    public Response toResponse(UpstreamException e) {
        return Response.status(Response.Status.BAD_GATEWAY)
                .entity(new ErrorResponse(502, "Bad Gateway", e.getMessage()))
                .build();
    }
}
