package com.upshift.common;

/** Thrown when the upstream AI API fails or returns something unusable. */
public class UpstreamException extends RuntimeException {

    public UpstreamException(String message, Throwable cause) {
        super(message, cause);
    }
}
