package in.yojanasaathi.common;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/dev/auth")
public class AuthController {

    @GetMapping
    public Map<String, String> authenticateDevUser(@RequestParam String role, @RequestParam String name) {
        // Since Phase 1 does not use JWT verification securely, we just return a stub
        // token.
        // We include the role explicitly so controllers can simulate reading it.
        String dummyToken = role + ":" + name + ":" + UUID.randomUUID().toString();
        return Map.of("token", dummyToken);
    }
}
