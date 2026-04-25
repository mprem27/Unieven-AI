package com.unieven.auth_service.controller;

import com.unieven.auth_service.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    //  Forgot Password → Send OTP
    @PostMapping("/forgot-password")
    public String forgotPassword(@RequestBody Map<String, String> body) {
        return authService.forgotPassword(body.get("email"));
    }

    //  Verify OTP
    @PostMapping("/verify-otp")
    public String verifyOtp(@RequestBody Map<String, String> body) {
        return authService.verifyOTP(
                body.get("email"),
                body.get("otp")
        );
    }
}