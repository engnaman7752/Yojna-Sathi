package in.yojanasaathi.eligibility.web;

import in.yojanasaathi.persistence.ApplicationRecord;
import in.yojanasaathi.persistence.ApplicationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/operator")
public class OperatorController {

        private final ApplicationRepository applicationRepository;

        public OperatorController(ApplicationRepository applicationRepository) {
                this.applicationRepository = applicationRepository;
        }

        @GetMapping("/applications")
        public List<ApplicationRecord> getApplications(@RequestParam(required = false) String status) {
                return applicationRepository.listAll(status);
        }

        @PostMapping("/applications")
        public ApplicationRecord createApplication(@RequestBody ApplicationRecord application) {
                if (application.getId() == null || application.getId().isBlank()) {
                        application.setId("APP-" + (int) (Math.random() * 90000 + 10000));
                }
                if (application.getDateSubmitted() == null) {
                        application.setDateSubmitted(ApplicationRepository.nowIsoTimestamp());
                }
                if (application.getStatus() == null) {
                        application.setStatus("PENDING_VDO");
                }
                return applicationRepository.save(application);
        }

        @PatchMapping("/applications/{id}")
        public ApplicationRecord updateStatus(@PathVariable String id, @RequestBody Map<String, String> payload) {
                String newStatus = payload.get("status");
                if (newStatus == null) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status is required");
                }

                ApplicationRecord record = applicationRepository.findById(id)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Application not found"));

                record.setStatus(newStatus);
                return applicationRepository.save(record);
        }
}
