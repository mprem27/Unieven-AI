package com.unieven.auth_service.service;

import com.unieven.auth_service.model.User;
import com.unieven.auth_service.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.Random;


@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;



    public String generateOTP() {
        return String.valueOf(
                100000 + new Random().nextInt(900000)
        );
    }

    public String forgotPassword(String email) {

        User user = userRepository
                .findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("User not found")
                );

        // Generate OTP
        String otp = generateOTP();

        // Save OTP + Expiry
        user.setResetOTP(otp);
        user.setOtpExpires(
                new Date(
                        System.currentTimeMillis() + 300000
                ) // 5 minutes
        );

        userRepository.save(user);

        try {
            // Send OTP Email
            emailService.sendOtp(
                    email,
                    otp
            );
        } catch (Exception e) {
            throw new RuntimeException(
                    "Failed to send OTP email: " +
                            e.getMessage()
            );
        }

        return "OTP sent successfully";
    }

    public String verifyOTP(
            String email,
            String otp
    ) {

        User user = userRepository
                .findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("User not found")
                );

        // OTP Missing
        if (
                user.getResetOTP() == null ||
                user.getResetOTP().isEmpty()
        ) {
            throw new RuntimeException(
                    "No OTP found. Please request again."
            );
        }

        // Invalid OTP
        if (
                !otp.trim().equals(
                        user.getResetOTP().trim()
                )
        ) {
            throw new RuntimeException(
                    "Invalid OTP"
            );
        }

        // Expired OTP
        if (
                user.getOtpExpires() == null ||
                new Date().after(
                        user.getOtpExpires()
                )
        ) {
            throw new RuntimeException(
                    "OTP expired"
            );
        }

        // Mark OTP verified
        user.setResetOTP("VERIFIED");

        userRepository.save(user);

        return "OTP verified successfully";
    }
}