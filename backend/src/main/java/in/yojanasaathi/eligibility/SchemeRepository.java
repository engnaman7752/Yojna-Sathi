package in.yojanasaathi.eligibility;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.yojanasaathi.config.CacheConfig;
import in.yojanasaathi.config.YojanaProperties;
import in.yojanasaathi.eligibility.domain.Condition;
import in.yojanasaathi.eligibility.domain.Evidence;
import in.yojanasaathi.eligibility.domain.SchemeVersion;
import in.yojanasaathi.eligibility.domain.VersionStatus;
import in.yojanasaathi.vocabulary.Vocabulary;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Repository;

/**
 * Holds the scheme versions read from data/schemes/*.json at startup.
 *
 * Phase 1 has no database; this is where DynamoDB arrives in Phase 2, behind
 * the same two methods.
 *
 * Validation happens once, at load, and is deliberately unforgiving: a scheme
 * file that references a field outside the vocabulary, declares no conditions,
 * or collides with another file on (schemeId, version) stops the application
 * from starting. A rule defect that reaches a citizen is a denied benefit, so
 * it is better to fail on the ground.
 */
@Repository
public class SchemeRepository {

    private static final Logger log = LoggerFactory.getLogger(SchemeRepository.class);
    private static final String SCHEMES_SUBDIR = "schemes";

    private final YojanaProperties properties;
    private final Vocabulary vocabulary;
    private final ObjectMapper mapper;

    /** Every version of every scheme, keyed by "schemeId@version". */
    private final Map<String, SchemeVersion> versions = new LinkedHashMap<>();

    public SchemeRepository(YojanaProperties properties, Vocabulary vocabulary, ObjectMapper mapper) {
        this.properties = properties;
        this.vocabulary = vocabulary;
        this.mapper = mapper;
    }

    @PostConstruct
    void loadFromDisk() {
        Path dir = Path.of(properties.data().dir()).resolve(SCHEMES_SUBDIR);
        if (!Files.isDirectory(dir)) {
            log.warn("No scheme directory at {} - no schemes loaded. "
                    + "Every eligibility check will return an empty result.", dir.toAbsolutePath());
            return;
        }
        List<Path> files;
        try (Stream<Path> stream = Files.list(dir)) {
            files = stream.filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().endsWith(".json"))
                    .sorted()
                    .toList();
        } catch (IOException e) {
            throw new IllegalStateException("Could not list scheme directory " + dir.toAbsolutePath(), e);
        }
        if (files.isEmpty()) {
            log.warn("Scheme directory {} contains no .json files - no schemes loaded. "
                    + "Every eligibility check will return an empty result.", dir.toAbsolutePath());
            return;
        }
        for (Path file : files) {
            SchemeVersion scheme = parse(file);
            String key = scheme.schemeId() + "@" + scheme.version();
            SchemeVersion clash = versions.put(key, scheme);
            if (clash != null) {
                throw new IllegalStateException(
                        "Two scheme files declare " + scheme.reference() + "; the second was " + file.toAbsolutePath());
            }
        }
        long published = versions.values().stream().filter(SchemeVersion::isPublished).count();
        log.info("Loaded {} scheme version(s) from {} ({} PUBLISHED, {} not published and therefore never evaluated)",
                versions.size(), dir.toAbsolutePath(), published, versions.size() - published);
    }

    /**
     * The scheme versions a household in {@code householdState} should be
     * checked against: PUBLISHED only, central schemes plus that state's own,
     * and for each scheme only its highest published version.
     */
    @Cacheable(CacheConfig.PUBLISHED_SCHEMES)
    public List<SchemeVersion> publishedSchemesFor(String householdState) {
        Map<String, SchemeVersion> latestByScheme = new LinkedHashMap<>();
        for (SchemeVersion scheme : versions.values()) {
            if (!scheme.isPublished() || !scheme.appliesInState(householdState)) {
                continue;
            }
            SchemeVersion current = latestByScheme.get(scheme.schemeId());
            if (current == null || scheme.version() > current.version()) {
                latestByScheme.put(scheme.schemeId(), scheme);
            }
        }
        return latestByScheme.values().stream()
                .sorted(Comparator.comparing(SchemeVersion::schemeId))
                .toList();
    }

    /** Every loaded version, published or not. For diagnostics and tests. */
    public List<SchemeVersion> all() {
        return List.copyOf(versions.values());
    }

    // ---------------------------------------------------------------- parsing

    private SchemeVersion parse(Path file) {
        JsonNode root;
        try {
            root = mapper.readTree(file.toFile());
        } catch (IOException e) {
            throw new IllegalStateException("Scheme file " + file.getFileName() + " is not readable JSON: "
                    + e.getMessage(), e);
        }

        String schemeId = requiredText(root, "schemeId", file);
        String name = requiredText(root, "name", file);
        String state = requiredText(root, "state", file);

        if (!root.hasNonNull("version") || !root.get("version").isInt() || root.get("version").asInt() < 1) {
            throw new IllegalStateException("Scheme file " + file.getFileName()
                    + " must have an integer \"version\" of 1 or more.");
        }
        int version = root.get("version").asInt();

        String statusText = requiredText(root, "status", file);
        VersionStatus status;
        try {
            status = VersionStatus.valueOf(statusText.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Scheme file " + file.getFileName() + " has status \"" + statusText
                    + "\"; expected one of DRAFT, PUBLISHED, REJECTED.");
        }

        JsonNode conditionsNode = root.get("conditions");
        if (conditionsNode == null || !conditionsNode.isArray() || conditionsNode.isEmpty()) {
            throw new IllegalStateException("Scheme file " + file.getFileName()
                    + " must declare a non-empty \"conditions\" array. A scheme with no conditions would make "
                    + "every household eligible.");
        }

        List<Condition> conditions = new ArrayList<>(conditionsNode.size());
        Set<String> seenIds = new LinkedHashSet<>();
        for (int i = 0; i < conditionsNode.size(); i++) {
            conditions.add(parseCondition(conditionsNode.get(i), i, seenIds, schemeId, version, file));
        }
        return new SchemeVersion(schemeId, name, state, version, status, conditions);
    }

    private Condition parseCondition(JsonNode node, int index, Set<String> seenIds,
                                     String schemeId, int version, Path file) {
        String where = "scheme " + schemeId + " v" + version + ", condition[" + index + "] in " + file.getFileName();

        if (node == null || !node.isObject()) {
            throw new IllegalStateException(where + " is not an object.");
        }
        String id = text(node, "id");
        if (id == null || id.isBlank()) {
            throw new IllegalStateException(where + " has no \"id\".");
        }
        if (!seenIds.add(id)) {
            throw new IllegalStateException(where + " reuses the condition id \"" + id + "\".");
        }
        String label = text(node, "label");
        if (label == null || label.isBlank()) {
            throw new IllegalStateException(where + " (\"" + id + "\") has no \"label\". "
                    + "The label is what a citizen is shown when the condition fails, so it is required.");
        }
        JsonNode rule = node.get("rule");
        if (rule == null || rule.isNull() || !rule.isObject()) {
            throw new IllegalStateException(where + " (\"" + id + "\") has no \"rule\" object.");
        }

        Set<String> referenced = JsonLogicVars.referencedFields(rule);
        if (referenced.isEmpty()) {
            throw new IllegalStateException(where + " (\"" + id + "\") reads no household fact. "
                    + "A condition that ignores the household is always the same answer.");
        }
        Set<String> unknown = new TreeSet<>();
        for (String field : referenced) {
            if (!vocabulary.knows(field)) {
                unknown.add(field);
            }
        }
        if (!unknown.isEmpty()) {
            throw new IllegalStateException(where + " (\"" + id + "\") references " + unknown
                    + ", which " + (unknown.size() == 1 ? "is" : "are") + " not in the field vocabulary. "
                    + "Allowed fields: " + vocabulary.fieldNames() + ".");
        }

        Evidence evidence = null;
        JsonNode evidenceNode = node.get("evidence");
        if (evidenceNode != null && evidenceNode.isObject()) {
            try {
                evidence = mapper.treeToValue(evidenceNode, Evidence.class);
            } catch (Exception e) {
                throw new IllegalStateException(where + " (\"" + id + "\") has an unreadable \"evidence\" block: "
                        + e.getMessage(), e);
            }
        }
        return new Condition(id, label, rule.toString(), evidence, referenced);
    }

    private static String requiredText(JsonNode root, String field, Path file) {
        String value = text(root, field);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Scheme file " + file.getFileName()
                    + " is missing the required text field \"" + field + "\".");
        }
        return value;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || !value.isTextual() ? null : value.asText();
    }
}
