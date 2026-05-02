package com.unieven.auth_service.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // 1. Disable CSRF as this is a stateless REST API
            .csrf(AbstractHttpConfigurer::disable)
            
            // 2. Enable CORS with the custom configuration below
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            
            // 3. Set permissions for endpoints
            .authorizeHttpRequests(auth -> auth
                // Explicitly allow health checks and auth routes
                .requestMatchers("/", "/api/auth/**").permitAll()
                // All other requests also permitted for now (internal microservice logic)
                .anyRequest().permitAll()
            );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // Allow all origins for the development/internal bridge phase
        config.setAllowedOriginPatterns(List.of("*"));

        // Explicitly list methods to support pre-flight OPTIONS requests
        config.setAllowedMethods(List.of(
                "GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"
        ));

        // Essential headers for Axios and JWT handling
        config.setAllowedHeaders(List.of(
                "Authorization",
                "Content-Type",
                "Accept",
                "X-Requested-With",
                "Cache-Control"
        ));

        // Allow clients to see these headers
        config.setExposedHeaders(List.of("Authorization"));

        // Must be false if allowedOrigins is "*"
        config.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        
        return source;
    }
}