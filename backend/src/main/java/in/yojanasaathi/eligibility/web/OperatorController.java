package in.yojanasaathi.eligibility.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/operator")
public class OperatorController {

    public record HouseholdRow(String householdId, String district, boolean consentActive, String consentExpiresAt) {
    }

    @GetMapping("/households")
    public List<HouseholdRow> getHouseholds(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        // Multi-tenancy simulation: if the frontend sends the token (which we simulated
        // as role:name:uuid)
        // We can create varied dummy data.

        String dummyDistrict = "BHAGALPUR";
        if (authHeader != null && authHeader.contains("Ramesh")) {
            dummyDistrict = "PATNA";
        }

        String expiresSoon = LocalDateTime.now().plusDays(2).format(DateTimeFormatter.ISO_LOCAL_DATE);
        String expired = LocalDateTime.now().minusDays(5).format(DateTimeFormatter.ISO_LOCAL_DATE);

        return List.of(
                new HouseholdRow("h-" + UUID.randomUUID().toString().substring(0, 12), dummyDistrict, true,
                        expiresSoon),
                new HouseholdRow("h-" + UUID.randomUUID().toString().substring(0, 12), dummyDistrict, true,
                        expiresSoon),
                new HouseholdRow("h-" + UUID.randomUUID().toString().substring(0, 12), dummyDistrict, false, expired),
                new HouseholdRow("h-" + UUID.randomUUID().toString().substring(0, 12), dummyDistrict, true,
                        expiresSoon));
    }
}
