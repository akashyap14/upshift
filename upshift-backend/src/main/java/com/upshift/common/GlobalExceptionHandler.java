package com.upshift.common;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.ElementKind;
import jakarta.validation.Path;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;
import org.jboss.resteasy.reactive.server.ServerExceptionMapper;

import java.util.ArrayList;
import java.util.List;

/** Maps every exception to a JSON {@link ErrorResponse}. */
public class GlobalExceptionHandler {

    private static final Logger LOG = Logger.getLogger(GlobalExceptionHandler.class);

    @ServerExceptionMapper
    public Response upstream(UpstreamException e) {
        return json(e.status(), e.getMessage(), null);
    }

    @ServerExceptionMapper
    public Response invalidProfession(InvalidProfessionException e) {
        return json(422, e.getMessage(), null);
    }

    @ServerExceptionMapper
    public Response documentRejected(DocumentRejectedException e) {
        return json(e.status(), e.getMessage(), null);
    }

    @ServerExceptionMapper
    public Response quizNotFound(QuizNotFoundException e) {
        return json(404, e.getMessage(), null);
    }

    @ServerExceptionMapper
    public Response quizAlreadySubmitted(QuizAlreadySubmittedException e) {
        return json(409, e.getMessage(), null);
    }

    @ServerExceptionMapper
    public Response invalidSubmission(InvalidSubmissionException e) {
        return json(400, e.getMessage(), e.details());
    }

    @ServerExceptionMapper
    public Response validation(ConstraintViolationException e) {
        List<String> details = e.getConstraintViolations().stream()
                .map(GlobalExceptionHandler::describe)
                .sorted()
                .toList();
        return json(400, "Invalid request", details);
    }

    @ServerExceptionMapper
    public Response mismatchedInput(MismatchedInputException e) {
        String field = e.getPath().isEmpty() ? null : e.getPath().get(e.getPath().size() - 1).getFieldName();
        String message = field == null ? "Request body is not valid JSON" : "Field '" + field + "' has the wrong type";
        return json(400, message, null);
    }

    @ServerExceptionMapper
    public Response badJson(JsonProcessingException e) {
        return json(400, "Request body is not valid JSON", null);
    }

    @ServerExceptionMapper
    public Response webApplication(WebApplicationException e) {
        int status = e.getResponse().getStatus();
        String message = switch (status) {
            case 400 -> "Request body is not valid JSON";
            case 404 -> "Endpoint not found. Available: " + String.join(", ", RootResource.ENDPOINTS);
            case 405 -> "HTTP method not allowed. Available: " + String.join(", ", RootResource.ENDPOINTS);
            case 406 -> "Response type not acceptable; use application/json";
            case 415 -> "Content-Type must be application/json";
            default -> Response.Status.fromStatusCode(status) != null
                    ? Response.Status.fromStatusCode(status).getReasonPhrase()
                    : "Request failed";
        };
        return json(status, message, null);
    }

    @ServerExceptionMapper
    public Response unexpected(Exception e) {
        LOG.error("Unexpected error", e);
        return json(500, "Something went wrong. Please try again.", null);
    }

    /**
     * Names the field for the UI. Paths look like "generate.request.profession" (a JSON body property:
     * drop method and parameter), "uploadAndGenerate.count" (a form/query parameter: keep it) or
     * "generate.request" (the whole body is missing).
     */
    static String describe(ConstraintViolation<?> v) {
        List<ElementKind> kinds = new ArrayList<>();
        for (Path.Node node : v.getPropertyPath()) {
            kinds.add(node.getKind());
        }
        String path = v.getPropertyPath().toString();
        if (!kinds.isEmpty() && kinds.get(0) == ElementKind.METHOD) {
            path = afterFirstDot(path);
            kinds.remove(0);
        }
        String field;
        if (kinds.size() > 1) {
            field = afterFirstDot(path).replace(".<list element>", ""); // drop the body parameter name
        } else {
            Object value = v.getInvalidValue();
            boolean simple = value instanceof CharSequence || value instanceof Number || value instanceof Boolean;
            field = path.isEmpty() || !simple ? "body" : path;
        }
        return field + ": " + v.getMessage();
    }

    private static String afterFirstDot(String path) {
        int dot = path.indexOf('.');
        return dot < 0 ? "" : path.substring(dot + 1);
    }

    private static Response json(int status, String message, List<String> details) {
        Response.Status known = Response.Status.fromStatusCode(status);
        String error = known != null ? known.getReasonPhrase() : (status == 422 ? "Unprocessable Entity" : "Error");
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity(new ErrorResponse(status, error, message, details))
                .build();
    }
}
