package com.upshift.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/** Single error shape for every failure, so the UI can always read {@code message}. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(int status, String error, String message, List<String> details) {

    public ErrorResponse(int status, String error, String message) {
        this(status, error, message, null);
    }
}
