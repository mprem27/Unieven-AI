import axios from "axios";
import 'dotenv/config';

/**
 * Sends OTP email using Brevo API (HTTP Port 443)
 * Works everywhere: Local Laptop and Render Server.
 */
export const sendOTPEmail = async (email, otp, purpose = "Account Verification", username = "Student") => {
  try {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      console.error(" ERROR: BREVO_API_KEY is missing in .env or Render settings.");
      return { success: false, message: "Email configuration missing" };
    }

    const isRegistration = purpose === "Account Verification";
    const isPasswordReset = purpose === "Password Reset";

    // 1. Dynamic Subject Line
    const emailSubject = isRegistration 
      ? `Welcome to UniEven! ${otp} is your verification code` 
      : `${otp} is your UniEven password reset code`;

    // 2. Dynamic Context Paragraph
    const contextHtml = isRegistration 
      ? `<p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
          Welcome to <strong>UniEven</strong>—the premium network designed exclusively for students to connect, create, and share campus experiences. 
          <br><br>
          To complete your registration and unlock your new profile, please verify your email address using the secure code below.
         </p>`
      : `<p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
          We received a request to reset the password associated with this email address.
         </p>
         <div style="background-color: #ffffff; padding: 16px; border-radius: 8px; border-left: 4px solid #2563eb; margin-bottom: 25px; text-align: left;">
          <p style="margin: 0; color: #334155; font-size: 14px; line-height: 1.5;">
            <strong>What to do next:</strong> Copy the 6-digit code below and paste it back into the UniEven application to verify your identity and create a new password.
          </p>
         </div>`;

    // 3. Dynamic Security Warning
    const securityWarningHtml = isRegistration
      ? `<div style="margin-top: 30px; padding: 16px; border-radius: 8px; background-color: #f8fafc; border: 1px solid #e2e8f0; text-align: left;">
          <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;">
            If you did not sign up for a UniEven account, you can safely ignore and delete this email.
          </p>
         </div>`
      : `<div style="margin-top: 30px; padding: 16px; border-radius: 8px; background-color: #fffbeb; border: 1px solid #fef3c7; text-align: left;">
          <h4 style="margin: 0 0 8px 0; color: #b45309; font-size: 14px;">Didn't request this change?</h4>
          <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
            If you did not try to reset your password, someone else might have entered your email by mistake. Your account is still safe, and you can safely ignore this email.
          </p>
         </div>`;

    // BREVO API CONFIGURATION
    const emailData = {
      sender: { name: isPasswordReset ? "UniEven Security" : "UniEven Welcome Team", email: "unievenwebsite@gmail.com" },
      to: [{ email: email.toLowerCase().trim() }],
      subject: emailSubject,
      htmlContent: `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 550px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
      
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="margin: 0; color: #2563eb; font-size: 28px; font-weight: 800;">UniEven</h1>
        <p style="color: #6b7280; font-size: 13px; margin-top: 4px; letter-spacing: 1px; text-transform: uppercase;">Connect. Create. Campus.</p>
      </div>
      
      <div style="padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #f1f5f9; text-align: center;">
        
        <!-- Greeting -->
        <h3 style="color: #1e293b; margin-top: 0; font-size: 18px; text-align: left;">Hello ${username},</h3>
        
        <!-- Dynamic Action Context (Registration vs Reset) -->
        ${contextHtml}

        <!-- OTP Display -->
        <div style="margin: 20px 0;">
          <div style="padding: 20px 30px; border: 2px dashed #3b82f6; display: inline-block; border-radius: 16px; background-color: #eff6ff;">
            <span style="font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #1d4ed8; font-family: monospace;">${otp}</span>
          </div>
          <p style="color: #ef4444; font-size: 13px; font-weight: 600; margin-top: 12px;">⏰ This code expires in exactly 5 minutes.</p>
        </div>
        
        <!-- Dynamic Security Information -->
        ${securityWarningHtml}

      </div>
      
      <!-- Footer & Support Links -->
      <div style="margin-top: 30px; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 20px;">
        <div style="margin-bottom: 16px;">
          <a href="#" style="color: #2563eb; text-decoration: none; font-size: 13px; font-weight: 600; margin: 0 12px;">Privacy Policy</a>
          <span style="color: #cbd5e1;">|</span>
          <a href="mailto:unievenwebsite@gmail.com" style="color: #2563eb; text-decoration: none; font-size: 13px; font-weight: 600; margin: 0 12px;">Contact Support</a>
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 4px;">This is an automated message from UniEven.</p>
        <p style="font-size: 11px; color: #cbd5e1; margin: 0;">© ${new Date().getFullYear()} UniEven Team. All rights reserved.</p>
      </div>
    </div>`
    };

    // CALL BREVO API VIA AXIOS
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      emailData,
      {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      }
    );

    console.log(` Email sent successfully to: ${email} for ${purpose}`);
    return { success: true, messageId: response.data.messageId };

  } catch (error) {
    if (error.response?.status === 502 || error.message.includes("502")) {
       console.error(" Brevo API Error: 502 Bad Gateway.");
       return { success: false, message: "Email service temporarily unavailable." };
    }
    const errorDetail = error.response?.data?.message || error.message;
    console.error(" Brevo API Error:", errorDetail);
    return { success: false, message: errorDetail };
  }
};