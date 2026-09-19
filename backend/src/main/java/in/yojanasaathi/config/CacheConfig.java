package in.yojanasaathi.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * PROJECT_BRIEF.md: "Never cache authorization decisions. Cache published scheme
 * rules only." The only cache declared here is the published-scheme lookup.
 */
@Configuration
public class CacheConfig {

    public static final String PUBLISHED_SCHEMES = "publishedSchemes";

    @Bean
    CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(PUBLISHED_SCHEMES);
        manager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(Duration.ofMinutes(10)));
        // Phase 1 loads schemes from disk once at startup, so this cache is not
        // doing much work yet. It exists so that the Phase 2 DynamoDB-backed
        // repository inherits the caching boundary rather than inventing one.
        manager.setAllowNullValues(false);
        return manager;
    }
}
