package in.yojanasaathi.vocabulary;

import com.fasterxml.jackson.databind.ObjectMapper;
import in.yojanasaathi.config.YojanaProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class VocabularyLoader {

    private static final Logger log = LoggerFactory.getLogger(VocabularyLoader.class);
    public static final String FILE_NAME = "vocabulary.json";

    @Bean
    public Vocabulary vocabulary(YojanaProperties properties, ObjectMapper mapper) {
        Path path = Path.of(properties.data().dir()).resolve(FILE_NAME);
        if (!Files.isReadable(path)) {
            throw new IllegalStateException(
                    "Field vocabulary not found or not readable at " + path.toAbsolutePath()
                            + ". Set yojana.data.dir to the directory containing " + FILE_NAME + ".");
        }
        try {
            Vocabulary vocabulary = mapper.readValue(path.toFile(), Vocabulary.class);
            if (vocabulary.fields().isEmpty()) {
                throw new IllegalStateException("Field vocabulary at " + path.toAbsolutePath() + " has no fields.");
            }
            log.info("Loaded field vocabulary v{} with {} fields from {}",
                    vocabulary.vocabularyVersion(), vocabulary.fields().size(), path.toAbsolutePath());
            return vocabulary;
        } catch (IOException e) {
            throw new IllegalStateException(
                    "Field vocabulary at " + path.toAbsolutePath() + " could not be read: " + e.getMessage(), e);
        }
    }
}
