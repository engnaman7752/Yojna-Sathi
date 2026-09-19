package in.yojanasaathi.common;

import com.fasterxml.jackson.annotation.JsonInclude;

/** PROJECT_BRIEF.md error shape: { code, message, correlationId, policyId? }. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(String code, String message, String correlationId, String policyId) {

    public static ApiError of(String code, String message, String correlationId) {
        return new ApiError(code, message, correlationId, null);
    }
}
