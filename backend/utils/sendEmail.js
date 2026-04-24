import nodemailer from "nodemailer";

export const sendOTPEmail = async (email, otp, purpose = "Account Verification") => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // App password
    },
  });

  // Dynamic text based on why the OTP is being sent
  const contextMessage = purpose === "Account Verification" 
    ? "Welcome to UniEven! Use the verification code below to verify your college email and join the premium campus network."
    : "You recently requested to reset your password or verify an action on your UniEven account. Use the code below to proceed.";

  const htmlTemplate = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
      
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #111827; font-size: 28px; font-weight: 900; margin: 0; letter-spacing: -0.5px;">UniEven</h1>
        <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; margin-top: 5px;">
          Connect. Create. Campus.
        </p>
      </div>

      <div style="background-color: #f8fafc; border-radius: 12px; padding: 30px; text-align: center; border: 1px solid #f1f5f9;">
        <h2 style="color: #1f2937; font-size: 20px; font-weight: 700; margin-top: 0;">${purpose}</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
          ${contextMessage}
        </p>
        
        <div style="background-color: #ffffff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 20px; display: inline-block;">
          <span style="font-family: monospace; font-size: 36px; font-weight: 900; color: #2563eb; letter-spacing: 8px;">
            ${otp}
          </span>
        </div>
        
        <p style="color: #ef4444; font-size: 13px; font-weight: 600; margin-top: 20px;">
         This code is valid for 5 minutes.
        </p>
      </div>

      <div style="margin-top: 30px; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 20px;">
        <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0;">
          If you didn't request this email, please ignore it or contact support if you have concerns. <br/>
          Please do not share this OTP with anyone.
        </p>
        <p style="color: #d1d5db; font-size: 12px; margin-top: 10px;">
          &copy; ${new Date().getFullYear()} UniEven. All rights reserved.
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"UniEven Security" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${otp} is your UniEven verification code`,
    html: htmlTemplate,
  });
};