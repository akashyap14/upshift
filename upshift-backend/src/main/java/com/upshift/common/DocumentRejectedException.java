package com.upshift.common;

/**
 * An uploaded document can't be used: not a PDF (415), too large (413), missing (400),
 * or unreadable / encrypted / without extractable text (422). The message is safe to show.
 */
public class DocumentRejectedException extends RuntimeException {

    private final int status;

    public DocumentRejectedException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int status() {
        return status;
    }
}
