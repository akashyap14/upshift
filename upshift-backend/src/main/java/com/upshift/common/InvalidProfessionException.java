package com.upshift.common;

/** Thrown when the AI decides the submitted profession is not a real job or role. */
public class InvalidProfessionException extends RuntimeException {

    public InvalidProfessionException(String message) {
        super(message);
    }
}
