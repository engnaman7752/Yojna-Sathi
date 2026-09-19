package in.yojanasaathi.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * PHASE 1 ONLY. Authentication is Phase 3 (JWT resource server) and
 * authorization is Cedar behind the Authorizer interface, also Phase 3.
 *
 * Spring Security is on the classpath now because the brief lists it as a
 * Phase 1 dependency; leaving it unconfigured would silently put HTTP Basic
 * with a generated password in front of the endpoint. This chain is therefore
 * deliberately open, and must be replaced before anything real is stored.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }
}
