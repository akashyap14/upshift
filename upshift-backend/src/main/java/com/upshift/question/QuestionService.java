package com.upshift.question;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.upshift.ai.AiService;
import com.upshift.question.QuestionModels.EvaluateRequest;
import com.upshift.question.QuestionModels.EvaluateResponse;
import com.upshift.question.QuestionModels.GenerateRequest;
import com.upshift.question.QuestionModels.GenerateResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class QuestionService {

    private static final String GENERATE_SYSTEM_PROMPT = """
            You are an expert interviewer. Generate interview questions for the given profession.
            Respond ONLY with valid JSON, no markdown, in exactly this shape:
            {"profession": "<profession>",
             "questions": [{"id": 1, "question": "<text>", "topic": "<short topic>", "difficulty": "<easy|medium|hard>"}]}
            """;

    private static final String EVALUATE_SYSTEM_PROMPT = """
            You are an expert interviewer grading a candidate's answers for the given profession.
            Score each answer from 0 to 10 and give concise, constructive feedback plus a brief ideal answer.
            overallScore is 0-100.
            Respond ONLY with valid JSON, no markdown, in exactly this shape:
            {"profession": "<profession>", "overallScore": 0, "summary": "<text>",
             "strengths": ["<text>"], "improvements": ["<text>"],
             "results": [{"id": 1, "question": "<text>", "score": 0, "feedback": "<text>", "idealAnswer": "<text>"}]}
            """;

    @Inject
    AiService ai;

    @Inject
    ObjectMapper mapper;

    public GenerateResponse generate(GenerateRequest request) {
        String userPrompt = "Profession: %s%nNumber of questions: %d%nDifficulty: %s".formatted(
                request.profession().strip(), request.countOrDefault(), request.difficultyOrDefault());
        return ai.askForJson(GENERATE_SYSTEM_PROMPT, userPrompt, GenerateResponse.class);
    }

    public EvaluateResponse evaluate(EvaluateRequest request) {
        String answersJson;
        try {
            answersJson = mapper.writeValueAsString(request.answers());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
        String userPrompt = "Profession: %s%nQuestions and candidate answers (JSON):%n%s".formatted(
                request.profession().strip(), answersJson);
        return ai.askForJson(EVALUATE_SYSTEM_PROMPT, userPrompt, EvaluateResponse.class);
    }
}
