package com.unieven.auth_service.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    public boolean sendOtp(
            String toEmail,
            String otp
    ) {

        try {

            SimpleMailMessage message =
                    new SimpleMailMessage();

            message.setFrom(fromEmail);
            message.setTo(toEmail);

            message.setSubject(
                    "UniEven - Password Reset Verification Code"
            );

            message.setText(
                    "Hello,\n\n" +

                    "We received a request to reset your UniEven account password.\n\n" +

                    "Your OTP is: " + otp + "\n\n" +

                    "This OTP is valid for 5 minutes.\n" +
                    "Please do NOT share this code with anyone.\n\n" +

                    "If you did not request this, please ignore this email.\n\n" +

                    "Best regards,\n" +
                    "UniEven Team"
            );

            mailSender.send(message);

            System.out.println(
                    "OTP email sent successfully to: " +
                    toEmail
            );

            return true;

        } catch (MailAuthenticationException e) {

            System.out.println(
                    "SMTP Authentication failed for sender: " +
                    fromEmail
            );

            return false;

        } catch (MailException e) {

            System.out.println(
                    "Mail server error while sending OTP to: " +
                    toEmail
            );

            return false;

        } catch (Exception e) {

            System.out.println(
                    "Unexpected email service error for: " +
                    toEmail
            );

            return false;
        }
    }
}