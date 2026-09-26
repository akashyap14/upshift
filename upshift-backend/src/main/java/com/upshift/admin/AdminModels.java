package com.upshift.admin;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.upshift.question.QuestionModels.Option;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

import java.time.Instant;
import java.util.List;

public final class AdminModels {

    private AdminModels() {
    }

    /** Body for regenerating questions from an already uploaded document. */
    public record RegenerateRequest(
            @Min(1) @Max(20) Integer count,
            @Pattern(regexp = "(?i)easy|medium|hard", message = "must be one of: easy, medium, hard")
            String difficulty) {
    }

    public record DocumentInfo(
            String id,
            String fileName,
            long sizeBytes,
            int pages,
            int characters,
            Instant uploadedAt,
            // Long documents are cut to fit the AI's input; these say how much was used.
            int pagesUsed,
            boolean truncated) {
    }

    /**
     * A generated MCQ for admins to review: unlike the player API, it includes the correct
     * answer, the explanation and the page of the PDF it came from.
     */
    public record AdminQuestion(
            int id,
            String question,
            List<Option> options,
            String correctAnswer,
            String explanation,
            String topic,
            String difficulty,
            Integer sourcePage) {
    }

    public record PdfQuestionsResponse(DocumentInfo document, int count, List<AdminQuestion> questions) {
    }

    /** Raw shape Claude returns for document questions. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AiDocumentResult(String error, String reason, List<AiDocumentQuestion> questions) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AiDocumentQuestion(
            String question,
            List<String> options,
            Integer correctIndex,
            String explanation,
            String topic,
            String difficulty,
            Integer sourcePage) {
    }
}
