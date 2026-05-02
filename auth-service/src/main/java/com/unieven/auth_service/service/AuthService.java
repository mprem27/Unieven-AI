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

    // We no longer call emailService here because Render blocks SMTP.
    // Node.js will handle the actual sending via Resend API.

    private static final SecureRandom secureRandom = new SecureRandom();

    /**
     * Generates a secure 6-digit OTP
     */
    public String generateOTP() {
        int otp = 100000 + secureRandom.nextInt(900000);
        return String.valueOf(otp);
    }

    /**
     * Handles Forgot Password OTP generation.
     * RETURNS: The generated OTP string so Node.js can send it via API.
     */
    public String forgotPassword(String email) {

        // 1. Check if user exists in the shared MongoDB
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found with this email"));

        // 2. Generate and set OTP
        String otp = generateOTP();
        user.setResetOTP(otp);

        // 3. Set expiration (Current time + 5 minutes)
        user.setOtpExpires(new Date(System.currentTimeMillis() + (5 * 60 * 1000)));

        // 4. Save to MongoDB
        // This is critical: Node.js will later check this exact record to verify.
        userRepository.save(user);

        // 5. RETURN THE OTP
        // We don't send the email from Java anymore. We give the code back to Node.js.
        return otp;
    }

    /**
     * Verifies the OTP and sets the status to VERIFIED for Node.js to finalize password change.
     */
    public String verifyOTP(String email, String otp) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // 1. Check if an OTP exists
        if (user.getResetOTP() == null || user.getResetOTP().isEmpty() || user.getResetOTP().equals("VERIFIED")) {
            throw new RuntimeException("No pending OTP request found.");
        }

        // 2. Check Expiration
        if (user.getOtpExpires() == null || new Date().after(user.getOtpExpires())) {
            throw new RuntimeException("OTP has expired.");
        }

        // 3. Compare OTP
        if (!otp.trim().equals(user.getResetOTP().trim())) {
            throw new RuntimeException("The OTP entered is incorrect.");
        }

        // 4. Mark as VERIFIED in DB
        user.setResetOTP("VERIFIED");
        userRepository.save(user);

        return "OTP verified";
    }
}