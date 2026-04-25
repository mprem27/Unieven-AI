package com.unieven.auth_service.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    public void sendOtp(String toEmail, String otp) {

        try {
            SimpleMailMessage message = new SimpleMailMessage();

            message.setTo(toEmail);
            message.setSubject(" UniEven - Password Reset Verification Code");

            message.setText(
                "Hello,\n\n" +
                "We received a request to reset your UniEven account password.\n\n" +

                " Your OTP is: " + otp + "\n\n" +

                " This OTP is valid for 5 minutes.\n" +
                " Please do NOT share this code with anyone.\n\n" +

                "If you did not request this, please ignore this email.\n\n" +

                "Best regards,\n" +
                "UniEven Team"
            );

            mailSender.send(message);

            //  Success log
            System.out.println(" OTP email sent successfully to: " + toEmail);

        } catch (Exception e) {
            //  Error log
            System.out.println(" Failed to send OTP email to: " + toEmail);
            e.printStackTrace();
        }
    }
}