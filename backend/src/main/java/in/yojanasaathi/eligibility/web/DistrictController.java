package in.yojanasaathi.eligibility.web;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import in.yojanasaathi.persistence.ApplicationRecord;
import in.yojanasaathi.persistence.ApplicationRepository;

/**
 * District officer / admin analytics.
 *
 * GET /api/district/summary            - system-wide totals
 * GET /api/district/summary?district=X - scoped to one district
 *
 * All numbers computed on demand from the applications table (Session 4).
 * Cheap while the table is small; move to materialised counters (a DDB row
 * like PK=STATS#<date>) if it ever gets slow. Not urgent - this endpoint
 * runs one query per district scope.
 *
 * Security: SecurityConfig gates this behind role check (DISTRICT_OFFICER
 * or ADMIN). Cross-district scoping - "an officer for Bhagalpur must only
 * see Bhagalpur's numbers" - belongs in Cedar, not here. For now every
 * authenticated staffer sees everything they query. Follow-up: cross-check
 * `district` query param against the caller's own district (needs a
 * `custom:district` attribute on the Cognito user).
 */
@RestController
@RequestMapping("/api/district")
public class DistrictController {

    /** How long an application can sit in one pending status before it counts as an SLA breach. */
    private static final long SLA_DAYS = 7;

    public record StatusCount(String status, int count, int slaBreached) {}
    public record SchemeCount(String scheme, int total, int pending, int approved, int rejected) {}
    public record RecentEvent(String appId, String applicant, String scheme, String status, String at) {}

    public record Summary(
            String district,          // "ALL" when unscoped
            int totalApplications,
            int pendingCount,
            int approvedCount,
            int rejectedCount,
            int slaBreachedCount,
            List<StatusCount> byStatus,
            List<SchemeCount> bySchemeEligible,   // named to match the existing frontend interface
            List<RecentEvent> recent
    ) {}

    private final ApplicationRepository apps;

    public DistrictController(ApplicationRepository apps) { this.apps = apps; }

    @GetMapping("/summary")
    public Summary summary(@RequestParam(required = false) String district) {
        List<ApplicationRecord> all = apps.listAll(null);
        List<ApplicationRecord> scoped = (district == null || district.isBlank())
                ? all
                : all.stream()
                    .filter(r -> district.equalsIgnoreCase(r.getDistrict()))
                    .toList();

        Instant now = Instant.now();

        // Counts per status, plus how many of those pending are past the SLA.
        Map<String, Integer> counts = new HashMap<>();
        Map<String, Integer> breached = new HashMap<>();
        int slaBreachedTotal = 0;
        for (ApplicationRecord r : scoped) {
            String s = r.getStatus();
            counts.merge(s, 1, Integer::sum);
            if (isPending(s) && isPastSla(r.getDateSubmitted(), now)) {
                breached.merge(s, 1, Integer::sum);
                slaBreachedTotal++;
            }
        }

        // Ordered display: pending stages first, then terminal ones.
        String[] displayOrder = {"PENDING_VDO", "PENDING_BDO", "PENDING_DISTRICT", "APPROVED", "REJECTED"};
        List<StatusCount> byStatus = java.util.Arrays.stream(displayOrder)
                .map(s -> new StatusCount(s, counts.getOrDefault(s, 0), breached.getOrDefault(s, 0)))
                .toList();

        // Per-scheme totals - useful to see which schemes are most active.
        Map<String, int[]> perScheme = new LinkedHashMap<>();
        for (ApplicationRecord r : scoped) {
            int[] counters = perScheme.computeIfAbsent(r.getScheme(), k -> new int[]{0, 0, 0, 0}); // total, pending, approved, rejected
            counters[0]++;
            switch (r.getStatus()) {
                case "APPROVED" -> counters[2]++;
                case "REJECTED" -> counters[3]++;
                default -> counters[1]++; // any PENDING_*
            }
        }
        List<SchemeCount> bySchemeEligible = perScheme.entrySet().stream()
                .map(e -> new SchemeCount(e.getKey(), e.getValue()[0], e.getValue()[1], e.getValue()[2], e.getValue()[3]))
                .sorted((a, b) -> Integer.compare(b.total(), a.total()))
                .toList();

        // Last 10 activities by date (newest first).
        List<RecentEvent> recent = scoped.stream()
                .sorted((a, b) -> {
                    String ad = a.getDateSubmitted() == null ? "" : a.getDateSubmitted();
                    String bd = b.getDateSubmitted() == null ? "" : b.getDateSubmitted();
                    return bd.compareTo(ad);
                })
                .limit(10)
                .map(r -> new RecentEvent(r.getId(), r.getApplicant(), r.getScheme(), r.getStatus(), r.getDateSubmitted()))
                .collect(Collectors.toList());

        int pending = counts.getOrDefault("PENDING_VDO", 0)
                + counts.getOrDefault("PENDING_BDO", 0)
                + counts.getOrDefault("PENDING_DISTRICT", 0);

        return new Summary(
                (district == null || district.isBlank()) ? "ALL" : district.toUpperCase(),
                scoped.size(),
                pending,
                counts.getOrDefault("APPROVED", 0),
                counts.getOrDefault("REJECTED", 0),
                slaBreachedTotal,
                byStatus,
                bySchemeEligible,
                recent
        );
    }

    private static boolean isPending(String status) {
        return status != null && status.startsWith("PENDING_");
    }

    private static boolean isPastSla(String submittedIso, Instant now) {
        try {
            Instant then = Instant.parse(submittedIso);
            return Duration.between(then, now).toDays() > SLA_DAYS;
        } catch (Exception e) {
            return false;
        }
    }
}
