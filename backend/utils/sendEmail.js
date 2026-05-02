import axios from "axios";
import 'dotenv/config';

export const sendOTPEmail = async (email, otp, purpose = "Account Verification") => {
  try {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      console.error(" ERROR: BREVO_API_KEY is missing.");
      return { success: false, message: "Email configuration missing" };
    }

    const contextMessage =
      purpose === "Account Verification"
        ? "Welcome to UniEven! Use the OTP below to verify your account."
        : "Use the OTP below to finalize your action on UniEven.";

    // Brevo API Payload
    const emailData = {
      sender: { name: "UniEven Security", email: "unievenwebsite@gmail.com" },
      to: [{ email: email.toLowerCase().trim() }],
      subject: `${otp} is your UniEven code`,
      htmlContent: `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="text-align: center; color: #2563eb;">UniEven</h2>
          <p style="font-size: 16px; color: #333;">${purpose}</p>
          <p>${contextMessage}</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb; padding: 10px 20px; border: 2px dashed #2563eb; border-radius: 5px;">
              ${otp}
            </span>
          </div>
          <p style="font-size: 12px; color: #666; text-align: center;">This code is valid for 5 minutes.</p>
        </div>
      `
    };

    // Call Brevo API via Axios
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

    console.log(` Email sent successfully to: ${email}`);
    return { success: true, messageId: response.data.messageId };

  } catch (error) {
    // Log the detailed error from Brevo
    const errorDetail = error.response?.data || error.message;
    console.error(" Brevo API Error:", errorDetail);
    
    return { 
      success: false, 
      message: error.response?.data?.message || "Email delivery failed" 
    };
  }
};