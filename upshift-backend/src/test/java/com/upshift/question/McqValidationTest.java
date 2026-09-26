package com.upshift.question;

import com.upshift.question.QuestionModels.AiQuestion;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class McqValidationTest {

    private static AiQuestion mcq(String question, List<String> options, Integer correctIndex) {
        return new AiQuestion(question, options, correctIndex, "because", "topic", "medium");
    }

    private static final List<String> FOUR = List.of("a", "b", "c", "d");

    @Test
    void acceptsWellFormedMcq() {
        assertTrue(QuestionService.isValidMcq(mcq("Q?", FOUR, 0)));
        assertTrue(QuestionService.isValidMcq(mcq("Q?", FOUR, 3)));
    }

    @Test
    void rejectsMissingOrBlankQuestion() {
        assertFalse(QuestionService.isValidMcq(null));
        assertFalse(QuestionService.isValidMcq(mcq(null, FOUR, 0)));
        assertFalse(QuestionService.isValidMcq(mcq("  ", FOUR, 0)));
    }

    @Test
    void rejectsWrongNumberOfOptions() {
        assertFalse(QuestionService.isValidMcq(mcq("Q?", null, 0)));
        assertFalse(QuestionService.isValidMcq(mcq("Q?", List.of("a", "b", "c"), 0)));
        assertFalse(QuestionService.isValidMcq(mcq("Q?", List.of("a", "b", "c", "d", "e"), 0)));
    }

    @Test
    void rejectsBlankOrDuplicateOptions() {
        assertFalse(QuestionService.isValidMcq(mcq("Q?", List.of("a", "b", " ", "d"), 0)));
        assertFalse(QuestionService.isValidMcq(mcq("Q?", Arrays.asList("a", "b", null, "d"), 0)));
        assertFalse(QuestionService.isValidMcq(mcq("Q?", List.of("a", "b", "A ", "d"), 0)));
    }

    @Test
    void rejectsMissingOrOutOfRangeCorrectIndex() {
        assertFalse(QuestionService.isValidMcq(mcq("Q?", FOUR, null)));
        assertFalse(QuestionService.isValidMcq(mcq("Q?", FOUR, -1)));
        assertFalse(QuestionService.isValidMcq(mcq("Q?", FOUR, 4)));
    }
}
