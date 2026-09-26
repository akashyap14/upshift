package com.upshift.admin;

import com.upshift.admin.AdminModels.PdfQuestionsResponse;
import com.upshift.admin.AdminModels.RegenerateRequest;
import com.upshift.admin.DocumentStore.StoredDocument;
import com.upshift.admin.PdfTextExtractor.ExtractedPdf;
import com.upshift.common.DocumentRejectedException;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.util.Optional;

/**
 * Admin panel: upload a PDF, store it locally, extract its text and generate MCQs from it.
 * Requires the X-Admin-Key header (see {@link AdminAuthFilter}).
 */
@Path("/api/admin/documents")
@Produces(MediaType.APPLICATION_JSON)
public class AdminDocumentResource {

    @Inject
    PdfTextExtractor extractor;

    @Inject
    DocumentStore store;

    @Inject
    DocumentQuestionService questions;

    @ConfigProperty(name = "upshift.admin.max-upload-bytes", defaultValue = "10485760")
    long maxUploadBytes;

    /** Multipart form: {@code file} (PDF, required), {@code count} (1-20), {@code difficulty}. */
    @POST
    @Path("/questions")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public PdfQuestionsResponse uploadAndGenerate(
            @RestForm("file") FileUpload file,
            @RestForm("count") @Min(1) @Max(20) Integer count,
            @RestForm("difficulty")
            @Pattern(regexp = "(?i)easy|medium|hard", message = "must be one of: easy, medium, hard")
            String difficulty) {
        if (file == null || file.uploadedFile() == null) {
            throw new DocumentRejectedException(400, "Attach a PDF in the multipart field 'file'.");
        }
        if (file.size() == 0) {
            throw new DocumentRejectedException(400, "The uploaded file is empty.");
        }
        if (file.size() > maxUploadBytes) {
            throw new DocumentRejectedException(413,
                    "The PDF is too large; the limit is " + (maxUploadBytes / (1024 * 1024)) + " MB.");
        }
        if (!PdfTextExtractor.looksLikePdf(file.uploadedFile())) {
            throw new DocumentRejectedException(415, "Only PDF files are supported.");
        }

        // Same bytes as a stored document: reuse its extracted text instead of parsing the PDF again.
        String sha256 = DocumentStore.sha256(file.uploadedFile());
        Optional<StoredDocument> existing = store.findBySha256(sha256);
        if (existing.isPresent()) {
            return questions.generate(existing.get(), store.pages(existing.get()), count, difficulty);
        }
        ExtractedPdf pdf = extractor.extract(file.uploadedFile());
        StoredDocument doc = store.save(file.uploadedFile(), sha256, file.fileName(), pdf);
        return questions.generate(doc, pdf.pages(), count, difficulty);
    }

    /** Generates a fresh set of questions from a previously uploaded document. */
    @POST
    @Path("/{id}/questions")
    @Consumes(MediaType.APPLICATION_JSON)
    public PdfQuestionsResponse regenerate(@PathParam("id") String id, @Valid RegenerateRequest request) {
        StoredDocument doc = store.find(id)
                .orElseThrow(() -> new DocumentRejectedException(404, "Document not found."));
        RegenerateRequest r = request == null ? new RegenerateRequest(null, null) : request;
        return questions.generate(doc, store.pages(doc), r.count(), r.difficulty());
    }
}
