package com.upshift.common;

/** The quizId is unknown, or the quiz has expired. */
public class QuizNotFoundException extends RuntimeException {

    public QuizNotFoundException(String message) {
        super(message);
    }
}
