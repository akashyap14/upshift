package com.upshift.common;

/** A quiz can only be graded once, so answers can't be discovered by resubmitting. */
public class QuizAlreadySubmittedException extends RuntimeException {

    public QuizAlreadySubmittedException(String message) {
        super(message);
    }
}
