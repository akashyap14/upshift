package com.upshift.question;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

public final class QuestionModels {

    private QuestionModels() {
    }

    // ---- Endpoint 1: generate ----

    public record GenerateRequest(
            @NotBlank @Size(min = 2, max = 100) String profession,
            @Min(1) @Max(20) Integer count,
            @Pattern(regexp = "(?i)easy|medium|hard", message = "must be one of: easy, medium, hard")
            String difficulty) {

        public int countOrDefault() {
            return count == null ? 5 : count;
        }

        public String difficultyOrDefault() {
            return difficulty == null ? "medium" : difficulty.toLowerCase(Locale.ROOT);
        }
    }

    /** One answer choice, labelled A-D. */
    public record Option(String id, String text) {
    }

    /** A multiple-choice question as sent to the UI. Deliberately has no correct answer. */
    public record Question(int id, String question, List<Option> options, String topic, String difficulty) {
    }

    public record GenerateResponse(
            String quizId,
            String profession,
            int count,
            Instant expiresAt,
            List<Question> questions) {
    }

    /** Raw shape Claude returns; either questions, or an error when the profession is invalid. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AiGenerateResult(String error, String reason, List<AiQuestion> questions) {
    }

    /** Raw question from Claude: 4 option texts plus the 0-based index of the correct one. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AiQuestion(
            String question,
            List<String> options,
            Integer correctIndex,
            String explanation,
            String topic,
            String difficulty) {
    }

    // ---- Endpoint 2: evaluate ----

    public record SelectedAnswer(
            @NotNull @Min(1) Integer questionId,
            @NotBlank
            @Pattern(regexp = "(?i)[A-D]", message = "must be one of: A, B, C, D")
            String selectedOption) {
    }

    public record EvaluateRequest(
            @NotBlank
            @Pattern(regexp = "[0-9a-fA-F-]{36}", message = "must be the quizId returned by /generate")
            String quizId,
            @NotNull @Size(max = 20) List<@NotNull @Valid SelectedAnswer> answers) {
    }

    /** Per-question result; correct answer and explanation are only revealed after submission. */
    public record QuestionResult(
            int questionId,
            String question,
            List<Option> options,
            String selectedOption,
            String correctAnswer,
            boolean correct,
            String explanation) {
    }

    public record EvaluateResponse(
            String quizId,
            String profession,
            int totalQuestions,
            int answered,
            int correct,
            int scorePercent,
            List<QuestionResult> results) {
    }
}
