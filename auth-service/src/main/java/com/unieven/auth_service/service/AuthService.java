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

    // 🔥 Generate OTP
    public String generateOTP() {
        return String.valueOf(100000 + new Random().nextInt(900000));
    }

    // 🔥 Forgot Password (SEND OTP ONLY)
    public String forgotPassword(String email) {

        User user = userRepository.findByEmail(email).orElse(null);

        if (user == null) {
            return "User not found";
        }

        String otp = generateOTP();

        // ✅ Save OTP in DB (same schema as Node)
        user.setResetOTP(otp);
        user.setOtpExpires(new Date(System.currentTimeMillis() + 300000)); // 5 min

        userRepository.save(user);

        // ✅ Send email
        emailService.sendOtp(email, otp);

        return "OTP sent to email";
    }

    // 🔥 Verify OTP (ONLY VERIFY — NO PASSWORD LOGIC)
    public String verifyOTP(String email, String otp) {

        User user = userRepository.findByEmail(email).orElse(null);

        if (user == null) {
            return "User not found";
        }

        // ❌ Invalid OTP
        if (user.getResetOTP() == null || !otp.equals(user.getResetOTP())) {
            return "Invalid OTP";
        }

        // ❌ Expired
        if (user.getOtpExpires() == null || new Date().after(user.getOtpExpires())) {
            return "OTP expired";
        }

        // ✅ Mark verified
        user.setResetOTP("VERIFIED");
        userRepository.save(user);

        return "OTP verified";
    }
}