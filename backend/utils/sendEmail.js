import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },

  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

// ======================================================
transporter.verify((error) => {
  if (error) {
    console.error(
      " Email transporter error:",
      error
    );
  } else {
    console.log(
      " Email server ready"
    );
  }
});


export const sendOTPEmail =
  async (
    email,
    otp,
    purpose =
      "Account Verification"
  ) => {
    try {

      const contextMessage =
        purpose ===
        "Account Verification"
          ? "Welcome to UniEven! Use the OTP below to verify your account."
          : "Use the OTP below to reset your UniEven password securely.";


      const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 550px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        
        <div style="text-align: center;">
          <h1 style="margin-bottom: 4px; color: #111827;">
            UniEven
          </h1>
          <p style="color: #6b7280; font-size: 12px;">
            Connect. Create. Campus.
          </p>
        </div>

        <div style="margin-top: 24px; text-align: center;">
          <h2 style="color: #1f2937;">
            ${purpose}
          </h2>

          <p style="color: #4b5563; font-size: 14px;">
            ${contextMessage}
          </p>

          <div style="margin: 24px 0; padding: 18px; border: 2px dashed #2563eb; display: inline-block; border-radius: 10px;">
            <span style="font-size: 34px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">
              ${otp}
            </span>
          </div>

          <p style="color: #dc2626; font-size: 13px;">
            OTP valid for 5 minutes
          </p>
        </div>

        <div style="margin-top: 28px; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 16px;">
          <p style="font-size: 12px; color: #9ca3af;">
            Do not share this OTP with anyone.
          </p>

          <p style="font-size: 11px; color: #d1d5db;">
            © ${new Date().getFullYear()} UniEven
          </p>
        </div>
      </div>
      `;

      const info =
        await transporter.sendMail({
          from: `"UniEven Security" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: `${otp} is your UniEven verification code`,
          html: htmlTemplate,
        });


      console.log(
        ` OTP email sent to ${email}`
      );

      return info;
    } catch (error) {
      console.error(
        " OTP email failed:",
        error
      );

      throw new Error(
        "Failed to send OTP email"
      );
    }
  };