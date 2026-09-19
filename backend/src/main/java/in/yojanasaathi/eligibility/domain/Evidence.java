package in.yojanasaathi.eligibility.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Where a condition came from in the official document, so that an explanation
 * can cite a page rather than assert something.
 *
 * Optional in Phase 1: schemes are hand-written ground truth and there are no
 * PDFs yet. From Phase 6 the extractor populates it on every condition it drafts.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public record Evidence(String docId, Integer page, String quote) {
}
