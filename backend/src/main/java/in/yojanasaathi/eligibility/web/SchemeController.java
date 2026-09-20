package in.yojanasaathi.eligibility.web;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import in.yojanasaathi.config.YojanaProperties;
import in.yojanasaathi.eligibility.SchemeRepository;
import in.yojanasaathi.schemes.SchemeVersionRecord;
import in.yojanasaathi.schemes.SchemeVersionRepository;

/**
 * Scheme administration with real maker-checker (Session 5, enforcing Rule 2
 * of PROJECT_BRIEF.md: "nothing AI-generated goes live without a DIFFERENT
 * admin approving it").
 *
 * Editorial workflow:
 *   POST   /api/admin/schemes                   create/update a DRAFT
 *   GET    /api/admin/schemes                   list every version (all statuses)
 *   GET    /api/admin/schemes/{id}/versions     list versions of one scheme
 *   POST   /api/admin/schemes/{id}/versions/{v}/publish   promote DRAFT to PUBLISHED
 *   POST   /api/admin/schemes/{id}/versions/{v}/reject    kill a DRAFT
 *
 * Maker-checker enforcement (in Java, not Cedar yet):
 *   - Publisher must NOT be the drafter and must NOT be one of the editors.
 *   - Only DRAFT versions can be published; PUBLISHED/REJECTED are terminal.
 *   - Editing a DRAFT records the editor in `editors`.
 *
 * On publish, the JSON is ALSO written to data/schemes/ so the eligibility
 * engine's disk-backed SchemeRepository picks it up on its next reload. This
 * dual-write is a bridge until eligibility itself reads from DynamoDB - kept
 * consistent by writing DB first, then disk, then reloading the in-memory
 * repo, all inside publish().
 */
@RestController
@RequestMapping("/api/admin/schemes")
public class SchemeController {

    private static final String STATUS_DRAFT = "DRAFT";
    private static final String STATUS_PUBLISHED = "PUBLISHED";
    private static final String STATUS_REJECTED = "REJECTED";
    private static final String SCHEMES_SUBDIR = "schemes";

    private final SchemeVersionRepository versions;
    private final SchemeRepository legacyRepo;
    private final YojanaProperties properties;
    private final ObjectMapper mapper;

    public SchemeController(SchemeVersionRepository versions,
                            SchemeRepository legacyRepo,
                            YojanaProperties properties,
                            ObjectMapper mapper) {
        this.versions = versions;
        this.legacyRepo = legacyRepo;
        this.properties = properties;
        this.mapper = mapper;
    }

    // ----- Views -----

    @GetMapping
    public List<SchemeVersionRecord> listAll(@RequestParam(required = false) String status) {
        if (status != null && !status.isBlank()) return versions.listByStatus(status);
        return versions.listAll();
    }

    @GetMapping("/{id}/versions")
    public List<SchemeVersionRecord> listOne(@PathVariable String id) {
        return versions.listVersions(id);
    }

    // ----- Draft create/update -----

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SchemeVersionRecord saveDraft(@RequestBody JsonNode body, JwtAuthenticationToken auth) {
        String me = auth.getName();
        String schemeId = requiredString(body, "schemeId");
        int version = requiredInt(body, "version");
        String name = optionalString(body, "name", schemeId);
        String state = optionalString(body, "state", "ALL");

        Optional<SchemeVersionRecord> existing = versions.find(schemeId, version);
        SchemeVersionRecord rec = existing.orElseGet(SchemeVersionRecord::new);

        if (existing.isPresent()) {
            // Editing an existing row. Only DRAFTs can be edited; a published or
            // rejected version is immutable - to change it, create a new version.
            if (!STATUS_DRAFT.equals(rec.getStatus())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Version " + version + " of " + schemeId + " is " + rec.getStatus()
                                + " and cannot be edited. Create a new version instead.");
            }
            Set<String> editors = rec.getEditors() == null ? new HashSet<>() : new HashSet<>(rec.getEditors());
            if (!me.equals(rec.getDrafter())) editors.add(me);
            rec.setEditors(editors);
        } else {
            rec.setDrafter(me);
            rec.setEditors(Set.of());
        }

        rec.setSchemeId(schemeId);
        rec.setVersion(version);
        rec.setName(name);
        rec.setState(state);
        rec.setStatus(STATUS_DRAFT);
        rec.setUpdatedAt(Instant.now().toString());
        // Store the full submitted JSON so publish can write it back to disk verbatim.
        try {
            rec.setBody(mapper.writeValueAsString(body));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid JSON body");
        }
        versions.save(rec);
        return rec;
    }

    // ----- Publish (maker-checker) -----

    @PostMapping("/{id}/versions/{v}/publish")
    public SchemeVersionRecord publish(@PathVariable String id, @PathVariable int v,
                                       JwtAuthenticationToken auth) {
        String me = auth.getName();
        SchemeVersionRecord rec = versions.find(id, v)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if (!STATUS_DRAFT.equals(rec.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot publish a " + rec.getStatus() + " version.");
        }
        // Maker-checker: the person publishing MUST be different from the drafter
        // AND from anyone who edited the draft. This is Rule 2 of the brief.
        if (me.equals(rec.getDrafter())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "SELF_APPROVAL_FORBIDDEN: you drafted this version. Ask a different admin to publish it.");
        }
        if (rec.getEditors() != null && rec.getEditors().contains(me)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "SELF_APPROVAL_FORBIDDEN: you edited this draft. Ask a different admin to publish it.");
        }

        // Write to DB first (source of truth for the workflow state).
        rec.setStatus(STATUS_PUBLISHED);
        rec.setPublishedBy(me);
        rec.setPublishedAt(Instant.now().toString());
        rec.setUpdatedAt(rec.getPublishedAt());
        versions.save(rec);

        // Then write to disk so the eligibility engine picks it up on reload.
        // If disk write fails, roll the DB row back to DRAFT so the states stay
        // in sync - otherwise the workflow says "published" and eligibility
        // doesn't know about it.
        try {
            writeToDisk(rec);
        } catch (IOException e) {
            rec.setStatus(STATUS_DRAFT);
            rec.setPublishedBy(null);
            rec.setPublishedAt(null);
            versions.save(rec);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Publish rolled back: could not write scheme file to disk.");
        }
        legacyRepo.reload();
        return rec;
    }

    // ----- Reject -----

    @PostMapping("/{id}/versions/{v}/reject")
    public SchemeVersionRecord reject(@PathVariable String id, @PathVariable int v,
                                      JwtAuthenticationToken auth) {
        SchemeVersionRecord rec = versions.find(id, v)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!STATUS_DRAFT.equals(rec.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Only DRAFT versions can be rejected.");
        }
        rec.setStatus(STATUS_REJECTED);
        rec.setUpdatedAt(Instant.now().toString());
        versions.save(rec);
        return rec;
    }

    // ----- helpers -----

    private void writeToDisk(SchemeVersionRecord rec) throws IOException {
        Path dir = Path.of(properties.data().dir()).resolve(SCHEMES_SUBDIR);
        Files.createDirectories(dir);
        Path file = dir.resolve(rec.getSchemeId() + "-v" + rec.getVersion() + ".json");
        JsonNode body = mapper.readTree(rec.getBody());
        mapper.writerWithDefaultPrettyPrinter().writeValue(file.toFile(), body);
    }

    private static String requiredString(JsonNode n, String field) {
        JsonNode v = n.get(field);
        if (v == null || v.isNull() || v.asText().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " is required");
        }
        return v.asText();
    }

    private static int requiredInt(JsonNode n, String field) {
        JsonNode v = n.get(field);
        if (v == null || !v.canConvertToInt()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be an integer");
        }
        return v.asInt();
    }

    private static String optionalString(JsonNode n, String field, String fallback) {
        JsonNode v = n.get(field);
        return (v == null || v.isNull() || v.asText().isBlank()) ? fallback : v.asText();
    }
}
