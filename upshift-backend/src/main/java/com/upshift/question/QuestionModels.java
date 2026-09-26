package com.upshift.question;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

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

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Question(int id, String question, String topic, String difficulty) {
    }

    public record GenerateResponse(String profession, int count, List<Question> questions) {
    }

    /** Raw shape Claude returns; either questions, or an error when the profession is invalid. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AiGenerateResult(String error, String reason, List<Question> questions) {
    }

    // ---- Endpoint 2: evaluate ----

    public record AnsweredQuestion(
            int id,
            @NotBlank String question,
            @NotNull String answer) {
    }

    public record EvaluateRequest(
            @NotBlank @Size(max = 100) String profession,
            @NotEmpty @Size(max = 20) List<@Valid AnsweredQuestion> answers) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record QuestionResult(int id, String question, int score, String feedback, String idealAnswer) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record EvaluateResponse(
            String profession,
            int overallScore,
            String summary,
            List<String> strengths,
            List<String> improvements,
            List<QuestionResult> results) {
    }
}
