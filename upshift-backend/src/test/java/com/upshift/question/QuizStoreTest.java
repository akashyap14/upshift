package com.upshift.question;

import com.upshift.question.QuestionModels.Option;
import com.upshift.question.QuestionModels.Question;
import com.upshift.question.QuizStore.Quiz;
import com.upshift.question.QuizStore.StoredQuestion;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class QuizStoreTest {

    private QuizStore store;
    private Instant now;

    private static final List<StoredQuestion> QUESTIONS = List.of(new StoredQuestion(
            new Question(1, "Q?", List.of(new Option("A", "a"), new Option("B", "b"),
                    new Option("C", "c"), new Option("D", "d")), "t", "easy"),
            "A", "because"));

    @BeforeEach
    void setUp() {
        store = new QuizStore();
        store.ttl = Duration.ofHours(2);
        store.maxStored = 3;
        now = Instant.parse("2026-09-26T10:00:00Z");
        store.clock = Clock.fixed(now, ZoneOffset.UTC);
    }

    @Test
    void findsSavedQuizCaseInsensitively() {
        Quiz quiz = store.save("Chef", QUESTIONS);
        assertTrue(store.find(quiz.id()).isPresent());
        assertTrue(store.find(quiz.id().toUpperCase()).isPresent());
        assertEquals(now.plus(Duration.ofHours(2)), quiz.expiresAt());
    }

    @Test
    void expiredQuizIsNotFound() {
        Quiz quiz = store.save("Chef", QUESTIONS);
        store.clock = Clock.fixed(now.plus(Duration.ofHours(2)), ZoneOffset.UTC);
        assertFalse(store.find(quiz.id()).isPresent());
        assertEquals(0, store.size());
    }

    @Test
    void evictsOldestWhenFull() {
        Quiz first = store.save("A", QUESTIONS);
        for (int i = 1; i <= 3; i++) {
            store.clock = Clock.fixed(now.plusSeconds(i), ZoneOffset.UTC);
            store.save("P" + i, QUESTIONS);
        }
        assertEquals(3, store.size());
        assertFalse(store.find(first.id()).isPresent());
    }

    @Test
    void quizCanOnlyBeSubmittedOnce() {
        Quiz quiz = store.save("Chef", QUESTIONS);
        assertTrue(quiz.markSubmitted());
        assertFalse(quiz.markSubmitted());
    }
}
