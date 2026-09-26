package com.upshift.admin;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

/** Builds small real PDFs for tests. */
final class TestPdfs {

    private TestPdfs() {
    }

    /** One page per entry; each line of a page's text is drawn on its own line. */
    static byte[] withPages(List<String> pages) {
        return build(pages, null);
    }

    static byte[] blank(int pages) {
        return build(java.util.Collections.nCopies(pages, ""), null);
    }

    static byte[] encrypted(String text) {
        return build(List.of(text), "secret");
    }

    static final String PAGE_1 = """
            Chapter 1: Photosynthesis
            Photosynthesis is the process plants use to convert light energy into chemical energy.
            It takes place in the chloroplasts, which contain the green pigment chlorophyll.
            The main products are glucose and oxygen; carbon dioxide and water are the inputs.""";

    static final String PAGE_2 = """
            Chapter 2: Cellular respiration
            Cellular respiration releases energy from glucose. It happens mainly in the mitochondria.
            Aerobic respiration requires oxygen and produces carbon dioxide, water and ATP.
            ATP is the main energy currency of the cell.""";

    static byte[] sample() {
        return withPages(List.of(PAGE_1, PAGE_2));
    }

    private static byte[] build(List<String> pages, String userPassword) {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            for (String text : pages) {
                PDPage page = new PDPage();
                doc.addPage(page);
                if (text.isEmpty()) {
                    continue;
                }
                try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                    cs.beginText();
                    cs.setFont(font, 11);
                    cs.setLeading(14);
                    cs.newLineAtOffset(50, 740);
                    for (String line : text.split("\n")) {
                        cs.showText(line);
                        cs.newLine();
                    }
                    cs.endText();
                }
            }
            if (userPassword != null) {
                StandardProtectionPolicy policy = new StandardProtectionPolicy("owner", userPassword, new AccessPermission());
                policy.setEncryptionKeyLength(128);
                doc.protect(policy);
            }
            doc.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
