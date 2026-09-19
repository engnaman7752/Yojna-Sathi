package in.yojanasaathi.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Puts a correlation id on every request so the error shape and the logs agree.
 * Accepts an inbound X-Correlation-Id (the AI service will forward one in a
 * later phase) and otherwise mints a fresh one.
 */
@Component
@Order(1)
public class CorrelationId extends OncePerRequestFilter {

    public static final String HEADER = "X-Correlation-Id";
    public static final String ATTRIBUTE = "correlationId";
    private static final String MDC_KEY = "correlationId";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String inbound = request.getHeader(HEADER);
        String id = (inbound == null || inbound.isBlank()) ? UUID.randomUUID().toString() : inbound.trim();
        request.setAttribute(ATTRIBUTE, id);
        response.setHeader(HEADER, id);
        MDC.put(MDC_KEY, id);
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }

    /** Never returns null, so an error response always carries an id. */
    public static String current(HttpServletRequest request) {
        Object value = request == null ? null : request.getAttribute(ATTRIBUTE);
        return value instanceof String s ? s : UUID.randomUUID().toString();
    }
}
