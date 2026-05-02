import axios from "axios";
import 'dotenv/config';

/**
 * Sends OTP email using Brevo API (HTTP Port 443)
 * Works everywhere: Local Laptop and Render Server.
 */
export const sendOTPEmail = async (email, otp, purpose = "Account Verification") => {
  try {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      console.error("❌ ERROR: BREVO_API_KEY is missing in .env or Render settings.");
      return { success: false, message: "Email configuration missing" };
    }

    const contextMessage =
      purpose === "Account Verification"
        ? "Welcome to UniEven! Use the OTP below to verify your account."
        : "Use the OTP below to finalize your action on UniEven.";

    // BREVO API CONFIGURATION
    const emailData = {
      sender: { name: "UniEven Support", email: "unievenwebsite@gmail.com" },
      to: [{ email: email.toLowerCase().trim() }],
      subject: `${otp} is your UniEven code`,
      htmlContent: `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 550px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="margin: 0; color: #2563eb; font-size: 28px;">UniEven</h1>
        <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Connect. Create. Campus.</p>
      </div>
      <div style="padding: 20px; background-color: #f9fafb; border-radius: 8px; text-align: center;">
        <h2 style="color: #1f2937; margin-top: 0;">${purpose}</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">${contextMessage}</p>
        <div style="margin: 30px 0; padding: 20px; border: 2px dashed #2563eb; display: inline-block; border-radius: 12px; background-color: #eff6ff;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #2563eb;">${otp}</span>
        </div>
        <p style="color: #ef4444; font-size: 14px; font-weight: 500;">Valid for 5 minutes only.</p>
      </div>
      <div style="margin-top: 30px; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 20px;">
        <p style="font-size: 12px; color: #9ca3af; margin-bottom: 8px;">Sent from UniEven Project</p>
        <p style="font-size: 11px; color: #d1d5db;">© ${new Date().getFullYear()} UniEven Team</p>
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

    console.log(`✅ Email sent successfully to: ${email}`);
    return { success: true, messageId: response.data.messageId };

  } catch (error) {
    const errorDetail = error.response?.data?.message || error.message;
    console.error("❌ Brevo API Error:", errorDetail);
    return { success: false, message: errorDetail };
  }
};