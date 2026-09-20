package in.yojanasaathi.auth;

import in.yojanasaathi.persistence.UserRecord;
import in.yojanasaathi.persistence.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class UserController {

    private final UserRepository userRepository;

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Public registration endpoint. In a real system, the user is created in
     * Cognito first.
     * Here we just log the request in DynamoDB for admin approval.
     */
    @PostMapping("/users/register")
    public void registerUser(@RequestBody Map<String, String> payload) {
        String email = payload.get("email");
        String name = payload.get("name");
        String role = payload.get("role"); // CSC_OPERATOR, VILLAGE_OFFICER, BLOCK_OFFICER, DISTRICT_OFFICER
        String district = payload.get("district");

        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }

        Optional<UserRecord> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User already exists or has pending request");
        }

        UserRecord user = new UserRecord();
        user.setEmail(email);
        user.setName(name);
        user.setRole(role);
        user.setDistrict(district);
        user.setStatus("PENDING_APPROVAL");
        user.setDateRequested(Instant.now().toString());

        userRepository.save(user);
    }

    /**
     * Admin view of pending users.
     */
    @GetMapping("/admin/users")
    public List<UserRecord> getPendingUsers() {
        return userRepository.listByStatus("PENDING_APPROVAL");
    }

    /**
     * Admin approves a user.
     * In a live environment, this would call AWS SDK:
     * cognitoIdentityProvider.adminAddUserToGroup()
     */
    @PatchMapping("/admin/users/{email}/approve")
    public void approveUser(@PathVariable String email) {
        UserRecord user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }
        user.setStatus("APPROVED");
        userRepository.save(user);
    }
}
