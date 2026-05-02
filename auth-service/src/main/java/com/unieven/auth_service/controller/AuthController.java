package com.unieven.auth_service.controller;

import com.unieven.auth_service.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*") 
public class AuthController {

    @Autowired
    private AuthService authService;

    @GetMapping
    public ResponseEntity<?> healthCheck() {
        return ResponseEntity.ok(
                Map.of(
                        "success", true,
                        "message", "Spring Boot OTP Service is online"
                )
        );
    }

    /**
     * Triggered by Node.js. 
     * Generates OTP in DB and returns it to Node.js to be sent via Resend API.
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        try {
            String email = body.get("email");

            if (email == null || email.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(
                        Map.of("success", false, "message", "Email is required")
                );
            }

            String cleanEmail = email.trim().toLowerCase();
            System.out.println("Generating reset OTP for: " + cleanEmail);

            // This now returns the actual 6-digit OTP string from the service
            String otp = authService.forgotPassword(cleanEmail);

            // We return 'otp' to Node.js so Node can act as the "Postman"
            return ResponseEntity.ok(
                    Map.of(
                        "success", true, 
                        "otp", otp, 
                        "message", "OTP generated successfully"
                    )
            );

        } catch (RuntimeException e) {
            System.err.println("Forgot password business error: " + e.getMessage());
            return ResponseEntity.status(400).body(
                    Map.of("success", false, "message", e.getMessage())
            );
        } catch (Exception e) {
            System.err.println("Forgot password system error: " + e.getMessage());
            return ResponseEntity.status(500).body(
                    Map.of("success", false, "message", "Internal server error during OTP generation")
            );
        }
    }

    /**
     * Triggered by Node.js to verify the OTP.
     * Marks user as VERIFIED in DB if successful.
     */
    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@RequestBody Map<String, String> body) {
        try {
            String email = body.get("email");
            String otp = body.get("otp");

            if (email == null || email.trim().isEmpty() || otp == null || otp.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(
                        Map.of("success", false, "message", "Email and OTP are both required")
                );
            }

            String cleanEmail = email.trim().toLowerCase();
            String cleanOtp = otp.trim();

            System.out.println("Verifying OTP for: " + cleanEmail);

            String response = authService.verifyOTP(cleanEmail, cleanOtp);

            return ResponseEntity.ok(
                    Map.of("success", true, "message", response)
            );

        } catch (RuntimeException e) {
            System.err.println("OTP Verification failed: " + e.getMessage());
            return ResponseEntity.status(400).body(
                    Map.of("success", false, "message", e.getMessage())
            );
        } catch (Exception e) {
            System.err.println("Internal OTP error: " + e.getMessage());
            return ResponseEntity.status(500).body(
                    Map.of("success", false, "message", "Internal server error during verification")
            );
        }
    }
}