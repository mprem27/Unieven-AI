import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    // This prevents errors on some hosting providers (like Render/Heroku)
    rejectUnauthorized: false,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,
});

// Verify connection configuration
transporter.verify((error) => {
  if (error) {
    console.error("❌ Email transporter error:", error.message);
  } else {
    console.log("✅ Node.js Email Server Ready (Registration Service)");
  }
});

/**
 * Specifically used for User Registration OTPs
 */
export const sendOTPEmail = async (email, otp, purpose = "Account Verification") => {
  try {
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

    const info = await transporter.sendMail({
      from: `"UniEven Security" <${process.env.EMAIL_USER}>`,
      to: email.toLowerCase().trim(),
      subject: `${otp} is your UniEven verification code`,
      html: htmlTemplate,
    });

    console.log(` Registration OTP sent to: ${email}`);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error(" Registration Email Failed:", error.message);
    return {
      success: false,
      message: "Email service temporarily unavailable",
    };
  }
};