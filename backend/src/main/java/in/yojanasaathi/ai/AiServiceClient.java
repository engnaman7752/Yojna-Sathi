package in.yojanasaathi.ai;

import in.yojanasaathi.common.CorrelationId;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import java.time.Duration;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * The backend's only outbound call to the AI service.
 *
 * Java never calls an LLM. This calls the Python service, which calls the
 * model; the boundary is kept so that authorization stays in one place and the
 * model never sits between a citizen and their data.
 *
 * The circuit breaker matters for a specific reason: when the AI service is
 * slow or down, a citizen must still be able to get an eligibility answer. The
 * breaker fails fast instead of holding threads, the fallback returns an
 * explicit "unavailable" rather than an error, and the frontend turns that into
 * the manual form that reaches the rule engine directly.
 */
@Component
public class AiServiceClient {

    private static final Logger log = LoggerFactory.getLogger(AiServiceClient.class);
    public static final String BREAKER = "aiService";

    private final RestClient client;

    public AiServiceClient(RestClient.Builder builder, @Value("${AI_SERVICE_URL:http://localhost:8000}") String baseUrl) {
        this.client = builder.baseUrl(baseUrl).build();
    }

    /** Whether the AI service is answering. Used to decide the frontend's fallback. */
    @CircuitBreaker(name = BREAKER, fallbackMethod = "unavailable")
    public AiHealth health() {
        client.get().uri("/health").retrieve().toBodilessEntity();
        return new AiHealth(true, null);
    }

    @SuppressWarnings("unused") // resolved by name by resilience4j
    private AiHealth unavailable(Throwable cause) {
        log.warn("AI service unavailable, the manual path stays open: {}", cause.toString());
        return new AiHealth(false, cause.getClass().getSimpleName());
    }

    public record AiHealth(boolean available, String reason) {
    }
}
