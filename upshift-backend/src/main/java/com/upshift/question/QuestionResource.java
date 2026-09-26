package com.upshift.question;

import com.upshift.question.QuestionModels.EvaluateRequest;
import com.upshift.question.QuestionModels.EvaluateResponse;
import com.upshift.question.QuestionModels.GenerateRequest;
import com.upshift.question.QuestionModels.GenerateResponse;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/questions")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class QuestionResource {

    @Inject
    QuestionService service;

    /** Endpoint 1: UI sends a profession, gets back generated interview questions. */
    @POST
    @Path("/generate")
    public GenerateResponse generate(@NotNull @Valid GenerateRequest request) {
        return service.generate(request);
    }

    /** Endpoint 2: UI sends the generated questions with the user's answers, gets back scores and feedback. */
    @POST
    @Path("/evaluate")
    public EvaluateResponse evaluate(@NotNull @Valid EvaluateRequest request) {
        return service.evaluate(request);
    }
}
