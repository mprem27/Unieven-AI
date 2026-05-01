package com.unieven.auth_service.service;

import com.unieven.auth_service.model.User;
import com.unieven.auth_service.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Date;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    private static final SecureRandom secureRandom =
            new SecureRandom();

    public String generateOTP() {
        int otp =
                100000 +
                secureRandom.nextInt(900000);

        return String.valueOf(otp);
    }

    public String forgotPassword(String email) {

        User user =
                userRepository.findByEmail(email)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "User not found"
                                )
                        );

        String otp = generateOTP();

        user.setResetOTP(otp);

        user.setOtpExpires(
                new Date(
                        System.currentTimeMillis() +
                        (5 * 60 * 1000)
                )
        );

        userRepository.save(user);

        boolean emailSent =
                emailService.sendOtp(
                        email,
                        otp
                );

        if (!emailSent) {
            throw new RuntimeException(
                    "Failed to send OTP email"
            );
        }

        return "OTP sent successfully";
    }

    public String verifyOTP(
            String email,
            String otp
    ) {

        User user =
                userRepository.findByEmail(email)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "User not found"
                                )
                        );

        if (
                user.getResetOTP() == null ||
                user.getResetOTP().isEmpty()
        ) {
            throw new RuntimeException(
                    "No OTP found. Please request again."
            );
        }

        if (
                !otp.trim().equals(
                        user.getResetOTP().trim()
                )
        ) {
            throw new RuntimeException(
                    "Invalid OTP"
            );
        }

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

        user.setResetOTP("VERIFIED");

        userRepository.save(user);

        return "OTP verified";
    }
}