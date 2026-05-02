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
                        "message", "Spring OTP Service Running"
                )
        );
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(
            @RequestBody Map<String, String> body
    ) {
        try {

            String email =
                    body.get("email");

            if (
                    email == null ||
                    email.trim().isEmpty()
            ) {
                return ResponseEntity.badRequest().body(
                        Map.of(
                                "success", false,
                                "message", "Email is required"
                        )
                );
            }

            email =
                    email.trim()
                            .toLowerCase();

            System.out.println(
                    "Forgot password OTP request for: " +
                    email
            );

            String response =
                    authService.forgotPassword(
                            email
                    );

            return ResponseEntity.ok(
                    Map.of(
                            "success", true,
                            "message", response
                    )
            );

        } catch (RuntimeException e) {

            System.out.println(
                    "Forgot password error: " +
                    e.getMessage()
            );

            return ResponseEntity.status(400).body(
                    Map.of(
                            "success", false,
                            "message", e.getMessage()
                    )
            );

        } catch (Exception e) {

            System.out.println(
                    "Internal forgot password error: " +
                    e.getMessage()
            );

            return ResponseEntity.status(500).body(
                    Map.of(
                            "success", false,
                            "message",
                            "Internal server error"
                    )
            );
        }
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(
            @RequestBody Map<String, String> body
    ) {
        try {

            String email =
                    body.get("email");

            String otp =
                    body.get("otp");

            if (
                    email == null ||
                    email.trim().isEmpty() ||
                    otp == null ||
                    otp.trim().isEmpty()
            ) {
                return ResponseEntity.badRequest().body(
                        Map.of(
                                "success", false,
                                "message",
                                "Email and OTP are required"
                        )
                );
            }

            email =
                    email.trim()
                            .toLowerCase();

            otp =
                    otp.trim();

            System.out.println(
                    "OTP verification request for: " +
                    email
            );

            String response =
                    authService.verifyOTP(
                            email,
                            otp
                    );

            return ResponseEntity.ok(
                    Map.of(
                            "success", true,
                            "message", response
                    )
            );

        } catch (RuntimeException e) {

            System.out.println(
                    "OTP verification error: " +
                    e.getMessage()
            );

            return ResponseEntity.status(400).body(
                    Map.of(
                            "success", false,
                            "message", e.getMessage()
                    )
            );

        } catch (Exception e) {

            System.out.println(
                    "Internal OTP verification error: " +
                    e.getMessage()
            );

            return ResponseEntity.status(500).body(
                    Map.of(
                            "success", false,
                            "message",
                            "Internal server error"
                    )
            );
        }
    }
}