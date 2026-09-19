package in.yojanasaathi.eligibility.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.yojanasaathi.config.YojanaProperties;
import in.yojanasaathi.eligibility.SchemeRepository;
import in.yojanasaathi.eligibility.domain.SchemeVersion;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Phase 6 endpoints for Maker-Checker scheme administration.
 * Currently backed by local filesystem JSON files for hackathon demo purposes.
 */
@RestController
@RequestMapping("/api/admin/schemes")
public class SchemeController {

    private final SchemeRepository schemeRepository;
    private final YojanaProperties properties;
    private final ObjectMapper mapper;
    private static final String SCHEMES_SUBDIR = "schemes";

    public SchemeController(SchemeRepository schemeRepository, YojanaProperties properties, ObjectMapper mapper) {
        this.schemeRepository = schemeRepository;
        this.properties = properties;
        this.mapper = mapper;
    }

    @GetMapping
    public List<SchemeVersion> getAllSchemes() {
        return schemeRepository.all();
    }

    @PostMapping
    public void saveScheme(@RequestBody JsonNode rawScheme) {
        try {
            // Validate basic structure
            if (!rawScheme.has("schemeId") || !rawScheme.has("version")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing schemeId or version");
            }

            String schemeId = rawScheme.get("schemeId").asText();
            int version = rawScheme.get("version").asInt();

            // Format filename consistently: schemeId-v{version}.json
            String filename = schemeId + "-v" + version + ".json";

            Path dir = Path.of(properties.data().dir()).resolve(SCHEMES_SUBDIR);
            if (!Files.isDirectory(dir)) {
                Files.createDirectories(dir);
            }

            Path file = dir.resolve(filename);

            // Pretty print the JSON to disk
            mapper.writerWithDefaultPrettyPrinter().writeValue(file.toFile(), rawScheme);

            // Reload the repository to instantly reflect the new/updated scheme
            schemeRepository.reload();

        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to save scheme file");
        } catch (IllegalStateException e) {
            // Catches validation errors thrown by the SchemeRepository parse step during
            // reload
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }
}
