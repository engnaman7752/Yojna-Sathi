package in.yojanasaathi.common;

import in.yojanasaathi.eligibility.RuleEvaluationException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * A rule that will not evaluate is a data defect, not a citizen's fault. It
     * is surfaced loudly rather than being turned into "not eligible", because a
     * silent false negative would deny someone a benefit they are entitled to.
     */
    @ExceptionHandler(RuleEvaluationException.class)
    ResponseEntity<ApiError> handleRuleEvaluation(RuleEvaluationException ex, HttpServletRequest request) {
        String correlationId = CorrelationId.current(request);
        log.error("rule evaluation failed [correlationId={}]: {}", correlationId, ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiError.of("RULE_EVALUATION_FAILED", ex.getMessage(), correlationId));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiError> handleBadRequest(IllegalArgumentException ex, HttpServletRequest request) {
        String correlationId = CorrelationId.current(request);
        log.warn("bad request [correlationId={}]: {}", correlationId, ex.getMessage());
        return ResponseEntity.badRequest()
                .body(ApiError.of("INVALID_REQUEST", ex.getMessage(), correlationId));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> handleUnreadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
        String correlationId = CorrelationId.current(request);
        log.warn("unreadable request body [correlationId={}]: {}", correlationId, ex.getMessage());
        return ResponseEntity.badRequest()
                .body(ApiError.of("INVALID_REQUEST", "Request body could not be parsed.", correlationId));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> handleUnexpected(Exception ex, HttpServletRequest request) {
        String correlationId = CorrelationId.current(request);
        log.error("unexpected failure [correlationId={}]", correlationId, ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiError.of("INTERNAL_ERROR",
                        "Something went wrong. Quote the correlation id when reporting this.", correlationId));
    }
}
