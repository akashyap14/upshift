package com.upshift.question;

import com.upshift.ai.ChatModels.Source;
import com.upshift.question.QuestionModels.Question;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Keeps each generated quiz's answer key on the server so the UI never sees correct answers
 * before submitting. In-memory: quizzes are lost on restart and not shared between instances.
 */
@ApplicationScoped
public class QuizStore {

    /** A question plus its answer key, which never leaves the server until the quiz is graded. */
    public record StoredQuestion(Question question, String correctAnswer, String explanation) {
    }

    public static final class Quiz {
        private final String id;
        private final String profession;
        private final List<StoredQuestion> questions;
        private final List<Source> sources;
        private final Instant createdAt;
        private final Instant expiresAt;
        private final AtomicBoolean submitted = new AtomicBoolean(false);

        Quiz(String id, String profession, List<StoredQuestion> questions, List<Source> sources,
             Instant createdAt, Instant expiresAt) {
            this.id = id;
            this.profession = profession;
            this.questions = List.copyOf(questions);
            this.sources = List.copyOf(sources);
            this.createdAt = createdAt;
            this.expiresAt = expiresAt;
        }

        public String id() {
            return id;
        }

        public String profession() {
            return profession;
        }

        public List<StoredQuestion> questions() {
            return questions;
        }

        public List<Source> sources() {
            return sources;
        }

        public Instant expiresAt() {
            return expiresAt;
        }

        /** Returns true only for the first caller, so each quiz can be graded once. */
        public boolean markSubmitted() {
            return submitted.compareAndSet(false, true);
        }
    }

    private final Map<String, Quiz> quizzes = new ConcurrentHashMap<>();

    @ConfigProperty(name = "upshift.quiz.ttl", defaultValue = "PT2H")
    Duration ttl;

    @ConfigProperty(name = "upshift.quiz.max-stored", defaultValue = "10000")
    int maxStored;

    Clock clock = Clock.systemUTC();

    public Quiz save(String profession, List<StoredQuestion> questions, List<Source> sources) {
        Instant now = clock.instant();
        purgeExpired(now);
        while (quizzes.size() >= maxStored) {
            quizzes.values().stream()
                    .min(Comparator.comparing(q -> q.createdAt))
                    .ifPresent(oldest -> quizzes.remove(oldest.id));
        }
        Quiz quiz = new Quiz(UUID.randomUUID().toString(), profession, questions, sources, now,
                now.plus(ttl));
        quizzes.put(quiz.id, quiz);
        return quiz;
    }

    public Optional<Quiz> find(String quizId) {
        Quiz quiz = quizzes.get(quizId.toLowerCase());
        if (quiz == null) {
            return Optional.empty();
        }
        if (!clock.instant().isBefore(quiz.expiresAt)) {
            quizzes.remove(quiz.id);
            return Optional.empty();
        }
        return Optional.of(quiz);
    }

    int size() {
        return quizzes.size();
    }

    private void purgeExpired(Instant now) {
        quizzes.values().removeIf(q -> !now.isBefore(q.expiresAt));
    }
}
