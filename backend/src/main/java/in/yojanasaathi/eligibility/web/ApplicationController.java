package in.yojanasaathi.eligibility.web;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import in.yojanasaathi.persistence.ApplicationRecord;
import in.yojanasaathi.persistence.ApplicationRepository;

/**
 * Verification-pipeline API.
 *
 * Backed by DynamoDB (via ApplicationRepository) as of Session 4. State
 * survives backend restarts and is shared across every ECS task hitting the
 * same table.
 *
 * Authorization: SecurityConfig gates the URL space (hasAnyRole check for
 * /api/operator/**). Cedar policy evaluation (per-record consent, district
 * scoping, VDO can only approve PENDING_VDO etc.) is the next layer and
 * still not wired - the switch(status) below enforces the state machine but
 * not the caller-role-vs-status relationship. THAT lives in Cedar (planned).
 */
@RestController
@RequestMapping("/api/operator/applications")
public class ApplicationController {

    public enum Status { PENDING_VDO, PENDING_BDO, PENDING_DISTRICT, APPROVED, REJECTED }

    public record Application(
            String id, String applicant, String scheme, String district,
            Status status, List<String> documents, String dateSubmitted
    ) {}

    public record CreateRequest(
            String applicant, List<String> schemes, String district, List<String> documents
    ) {}

    public record ActionRequest(String action) {}

    private final ApplicationRepository repo;

    public ApplicationController(ApplicationRepository repo) { this.repo = repo; }

    @GetMapping
    public List<Application> list(@RequestParam(required = false) String status) {
        return repo.listAll(status).stream().map(ApplicationController::toDomain).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public List<Application> create(@RequestBody CreateRequest req) {
        if (req == null || req.applicant() == null || req.applicant().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "applicant required");
        }
        if (req.schemes() == null || req.schemes().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "at least one scheme required");
        }
        String now = ApplicationRepository.nowIsoTimestamp();
        String district = (req.district() == null || req.district().isBlank()) ? "UNKNOWN" : req.district();
        List<String> docs = req.documents() == null ? List.of() : req.documents();

        List<Application> created = new ArrayList<>();
        // One application per scheme so each moves through the pipeline on its own.
        for (String scheme : req.schemes()) {
            String id = "APP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            ApplicationRecord rec = new ApplicationRecord();
            rec.setId(id);
            rec.setApplicant(req.applicant());
            rec.setScheme(scheme);
            rec.setDistrict(district);
            rec.setStatus(Status.PENDING_VDO.name());
            rec.setDocuments(docs);
            rec.setDateSubmitted(now);
            repo.save(rec);
            created.add(toDomain(rec));
        }
        return created;
    }

    @PatchMapping("/{id}")
    public Application act(@PathVariable String id, @RequestBody ActionRequest req) {
        ApplicationRecord rec = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (req == null || req.action() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "action required");
        }
        Status current = Status.valueOf(rec.getStatus());
        Status next = switch (req.action().toUpperCase()) {
            case "REJECT" -> Status.REJECTED;
            case "APPROVE" -> switch (current) {
                case PENDING_VDO -> Status.PENDING_BDO;
                case PENDING_BDO -> Status.PENDING_DISTRICT;
                case PENDING_DISTRICT -> Status.APPROVED;
                case APPROVED, REJECTED ->
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "already finalized");
            };
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown action");
        };
        rec.setStatus(next.name());
        repo.save(rec);
        return toDomain(rec);
    }

    private static Application toDomain(ApplicationRecord r) {
        return new Application(
                r.getId(), r.getApplicant(), r.getScheme(), r.getDistrict(),
                Status.valueOf(r.getStatus()),
                r.getDocuments() == null ? List.of() : r.getDocuments(),
                r.getDateSubmitted());
    }
}
