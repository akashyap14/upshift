package com.upshift.admin;

import com.upshift.common.DocumentRejectedException;
import jakarta.enterprise.context.ApplicationScoped;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Extracts text page by page with Apache PDFBox. */
@ApplicationScoped
public class PdfTextExtractor {

    private static final Logger LOG = Logger.getLogger(PdfTextExtractor.class);
    private static final byte[] PDF_MAGIC = "%PDF-".getBytes();

    /** Text of each page (index 0 = page 1). */
    public record ExtractedPdf(List<String> pages) {
        public int pageCount() {
            return pages.size();
        }

        public int characters() {
            return pages.stream().mapToInt(String::length).sum();
        }
    }

    @ConfigProperty(name = "upshift.admin.max-pages", defaultValue = "300")
    int maxPages;

    @ConfigProperty(name = "upshift.admin.min-text-chars", defaultValue = "200")
    int minTextChars;

    /** Checks the file starts with the PDF signature; the name and Content-Type can't be trusted. */
    public static boolean looksLikePdf(Path file) {
        try (InputStream in = Files.newInputStream(file)) {
            byte[] head = in.readNBytes(1024);
            // The signature is normally at byte 0, but the spec allows junk before it within the first 1 KB.
            for (int i = 0; i + PDF_MAGIC.length <= head.length; i++) {
                if (Arrays.equals(head, i, i + PDF_MAGIC.length, PDF_MAGIC, 0, PDF_MAGIC.length)) {
                    return true;
                }
            }
            return false;
        } catch (IOException e) {
            return false;
        }
    }

    public ExtractedPdf extract(Path file) {
        // loadPDF(File) owns the file handle and closes it even if parsing fails.
        try (PDDocument doc = Loader.loadPDF(file.toFile())) {
            int pageCount = doc.getNumberOfPages();
            if (pageCount == 0) {
                throw new DocumentRejectedException(422, "The PDF has no pages.");
            }
            if (pageCount > maxPages) {
                throw new DocumentRejectedException(422,
                        "The PDF has " + pageCount + " pages; the limit is " + maxPages + ".");
            }
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            List<String> pages = new ArrayList<>(pageCount);
            for (int p = 1; p <= pageCount; p++) {
                stripper.setStartPage(p);
                stripper.setEndPage(p);
                pages.add(normalize(stripper.getText(doc)));
            }
            ExtractedPdf pdf = new ExtractedPdf(List.copyOf(pages));
            if (pdf.characters() < minTextChars) {
                throw new DocumentRejectedException(422,
                        "The PDF has no selectable text (it may be a scanned image). Upload a text-based PDF.");
            }
            return pdf;
        } catch (InvalidPasswordException e) {
            throw new DocumentRejectedException(422, "The PDF is password-protected. Upload an unlocked copy.");
        } catch (DocumentRejectedException e) {
            throw e;
        } catch (IOException | RuntimeException e) {
            LOG.warn("Could not read PDF", e);
            throw new DocumentRejectedException(422, "The file could not be read as a PDF. It may be damaged.");
        }
    }

    /** Collapses runs of spaces and blank lines so the text sent to the AI is compact. */
    static String normalize(String text) {
        return text.replace(' ', ' ')
                .replaceAll("[ \\t\\x0B\\f]+", " ")
                .replaceAll(" *\\r?\\n *", "\n")
                .replaceAll("\\n{3,}", "\n\n")
                .strip();
    }
}
