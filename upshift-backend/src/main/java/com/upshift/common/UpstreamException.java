package com.upshift.common;

/**
 * Thrown when the upstream AI API fails or returns something unusable.
 * {@code status} is what we return to the UI; {@code getMessage()} is safe to show to users.
 */
public class UpstreamException extends RuntimeException {

    private final int status;

    public UpstreamException(int status, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
    }

    public int status() {
        return status;
    }
}
