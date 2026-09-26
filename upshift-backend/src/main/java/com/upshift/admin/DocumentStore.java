package com.upshift.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.upshift.admin.PdfTextExtractor.ExtractedPdf;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Stores uploaded PDFs on local disk under {@code upshift.admin.storage-dir}:
 * {@code <id>.pdf} (original), {@code <id>.txt} (extracted text, pages separated by form feeds)
 * and {@code <id>.json} (metadata). Ids are server-generated UUIDs; user file names are never used as paths.
 */
@ApplicationScoped
public class DocumentStore {

    private static final Logger LOG = Logger.getLogger(DocumentStore.class);
    private static final Pattern ID = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    private static final String PAGE_SEPARATOR = "\f";

    public record StoredDocument(
            String id,
            String fileName,
            long sizeBytes,
            String sha256,
            int pages,
            int characters,
            Instant uploadedAt) {
    }

    @ConfigProperty(name = "upshift.admin.storage-dir", defaultValue = "data/uploads")
    Path storageDir;

    @Inject
    ObjectMapper mapper;

    Clock clock = Clock.systemUTC();

    /** SHA-256 of stored PDFs -> document id; built from disk on first use. */
    private volatile Map<String, String> idsBySha256;

    public StoredDocument save(Path upload, String originalName, ExtractedPdf pdf) {
        return save(upload, sha256(upload), originalName, pdf);
    }

    /**
     * Saves the PDF and its text. If the same file (by SHA-256) was stored before, returns the
     * existing document instead of storing a duplicate.
     */
    public synchronized StoredDocument save(Path upload, String sha256, String originalName, ExtractedPdf pdf) {
        try {
            Optional<StoredDocument> existing = findBySha256(sha256);
            if (existing.isPresent()) {
                LOG.infof("Upload of '%s' matches stored document %s", originalName, existing.get().id());
                return existing.get();
            }
            Files.createDirectories(storageDir);

            String id = UUID.randomUUID().toString();
            Files.copy(upload, file(id, "pdf"), StandardCopyOption.REPLACE_EXISTING);
            Files.writeString(file(id, "txt"), String.join(PAGE_SEPARATOR, pdf.pages()), StandardCharsets.UTF_8);
            StoredDocument doc = new StoredDocument(id, safeFileName(originalName), Files.size(upload), sha256,
                    pdf.pageCount(), pdf.characters(), clock.instant());
            mapper.writeValue(file(id, "json").toFile(), doc);
            index().put(sha256, id);
            LOG.infof("Stored document %s ('%s', %d pages, %d chars)", id, doc.fileName(), doc.pages(),
                    doc.characters());
            return doc;
        } catch (IOException e) {
            throw new UncheckedIOException("Could not store uploaded document", e);
        }
    }

    public Optional<StoredDocument> find(String id) {
        if (id == null || !ID.matcher(id).matches()) {
            return Optional.empty();
        }
        Path meta = file(id, "json");
        if (!Files.exists(meta)) {
            return Optional.empty();
        }
        try {
            return Optional.of(mapper.readValue(meta.toFile(), StoredDocument.class));
        } catch (IOException e) {
            LOG.warnf(e, "Unreadable metadata for document %s", id);
            return Optional.empty();
        }
    }

    /** Extracted text of each page (index 0 = page 1). */
    public List<String> pages(StoredDocument doc) {
        try {
            String text = Files.readString(file(doc.id(), "txt"), StandardCharsets.UTF_8);
            return Arrays.asList(text.split(PAGE_SEPARATOR, -1));
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read stored text for " + doc.id(), e);
        }
    }

    /** The stored document with these exact bytes, if any (lets uploads skip re-parsing duplicates). */
    public Optional<StoredDocument> findBySha256(String sha256) {
        String id = index().get(sha256);
        return id == null ? Optional.empty() : find(id);
    }

    private Map<String, String> index() {
        Map<String, String> index = idsBySha256;
        if (index == null) {
            synchronized (this) {
                if (idsBySha256 == null) {
                    idsBySha256 = loadIndex();
                }
                index = idsBySha256;
            }
        }
        return index;
    }

    private Map<String, String> loadIndex() {
        Map<String, String> index = new ConcurrentHashMap<>();
        if (!Files.isDirectory(storageDir)) {
            return index;
        }
        try (Stream<Path> files = Files.list(storageDir)) {
            files.map(p -> p.getFileName().toString())
                    .filter(name -> name.endsWith(".json"))
                    .map(name -> find(name.substring(0, name.length() - ".json".length())))
                    .flatMap(Optional::stream)
                    .forEach(d -> index.putIfAbsent(d.sha256(), d.id()));
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read document storage", e);
        }
        LOG.infof("Indexed %d stored documents", index.size());
        return index;
    }

    private Path file(String id, String extension) {
        return storageDir.resolve(id + "." + extension);
    }

    /** Keeps only the base name, without control characters, for display. */
    static String safeFileName(String name) {
        if (name == null || name.isBlank()) {
            return "document.pdf";
        }
        String base = name.replace('\\', '/');
        base = base.substring(base.lastIndexOf('/') + 1).replaceAll("\\p{Cntrl}", "").strip();
        if (base.isEmpty()) {
            return "document.pdf";
        }
        return base.length() > 200 ? base.substring(0, 200) : base;
    }

    public static String sha256(Path file) {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
        try (InputStream in = new DigestInputStream(Files.newInputStream(file), digest)) {
            in.transferTo(OutputStream.nullOutputStream());
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read upload", e);
        }
        return HexFormat.of().formatHex(digest.digest());
    }
}
