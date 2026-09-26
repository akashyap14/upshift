package com.upshift.common;

import java.util.List;

/** The submitted answers don't match the quiz (unknown or duplicate question ids). */
public class InvalidSubmissionException extends RuntimeException {

    private final List<String> details;

    public InvalidSubmissionException(List<String> details) {
        super("Invalid answers");
        this.details = List.copyOf(details);
    }

    public List<String> details() {
        return details;
    }
}
