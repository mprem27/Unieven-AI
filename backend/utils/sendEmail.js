import { Resend } from "resend";
import 'dotenv/config'; // 🔥 This loads your RESEND_API_KEY from the .env file

// Initialize Resend with a fallback to prevent the "Missing API key" crash during startup
const resend = new Resend(process.env.RESEND_API_KEY || "placeholder_key");

/**
 * Sends OTP email using Resend API (HTTP Port 443)
 */
export const sendOTPEmail = async (email, otp, purpose = "Account Verification") => {
  try {
    // Safety check: If the key is still missing, don't try to send the email
    if (!process.env.RESEND_API_KEY) {
      console.error(" ERROR: RESEND_API_KEY is not defined in your .env file.");
      return { success: false, message: "Email configuration missing" };
    }

    const contextMessage =
      purpose === "Account Verification"
        ? "Welcome to UniEven! Use the OTP below to verify your account."
        : "Use the OTP below to finalize your action on UniEven.";

    const htmlTemplate = `
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
        <p style="font-size: 12px; color: #9ca3af; margin-bottom: 8px;">If you did not request this code, please ignore this email.</p>
        <p style="font-size: 11px; color: #d1d5db;">© ${new Date().getFullYear()} UniEven Team. All rights reserved.</p>
      </div>
    </div>
    `;

    // Resend API call
    const { data, error } = await resend.emails.send({
      from: "UniEven <onboarding@resend.dev>", 
      to: [email.toLowerCase().trim()],
      subject: `${otp} is your UniEven verification code`,
      html: htmlTemplate,
    });

    if (error) {
      console.error(" Resend API Error:", error);
      return { success: false, message: error.message };
    }

    console.log(` Email sent successfully to: ${email} (ID: ${data.id})`);

    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    console.error(" Email Service Failure:", error.message);
    return {
      success: false,
      message: error.message || "Email service temporarily unavailable",
    };
  }
};