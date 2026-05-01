import userModel from "../models/User.js";
import PendingRegistration from "../models/PendingRegistration.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import validator from "validator";
import { sendOTPEmail } from "../utils/sendEmail.js";
import { sendOtp, verifyOtp } from "../services/otpService.js";

//////////////////////////////////////////////////////
// 🔐 TOKEN
//////////////////////////////////////////////////////
const createToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

//////////////////////////////////////////////////////
// 🔥 ROLE DETECTION
//////////////////////////////////////////////////////
const detectRole = (email) => {
  const e = email.toLowerCase();
  if (e.startsWith("tts") && e.includes(".edu.in")) return "faculty";
  if (e.startsWith("vtu") && e.includes(".edu.in")) return "student";
  return "student"; // Default to student
};

//////////////////////////////////////////////////////
// 🔥 EMAIL TYPE
//////////////////////////////////////////////////////
const getEmailType = (email) => {
  const e = email.toLowerCase();
  if (e.startsWith("tts") && e.includes(".edu.in")) return "faculty";
  if (e.startsWith("vtu") && e.includes(".edu.in")) return "collegeStudent";
  return "normal";
};

//////////////////////////////////////////////////////
// 🔥 SEND REGISTER OTP
//////////////////////////////////////////////////////
export const sendRegisterOTP = async (req, res) => {
  try {
    let { email, username, password, name, dob } = req.body;

    email = email?.toLowerCase().trim();
    username = username?.toLowerCase().trim();

    // Check if all fields are provided
    if (!email || !username || !password || !name || !dob) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Validate email format (Removed strict college-only rule to allow public)
    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Validate username format
    if (!/^[a-z0-9._]{3,20}$/.test(username)) {
      return res.status(400).json({
        success: false,
        message: "Invalid username format. Use 3-20 characters (a-z, 0-9, ., _)",
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Check if email already fully registered
    const existingEmail = await userModel.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Check if username is already fully registered
    const existingUsername = await userModel.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: "Username already taken",
      });
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash password before storing pending data (Security Upgrade)
    const securePendingPassword = await bcrypt.hash(password, 10);

    // Store in PendingRegistration instead of polluting the real User model
    await PendingRegistration.findOneAndUpdate(
      { email },
      {
        email,
        username,
        password: securePendingPassword, 
        name,
        dob,
        otp,
        otpExpires: Date.now() + 5 * 60 * 1000, // 5 minutes expiration
      },
      {
        upsert: true,
        new: true,
      }
    );

    await sendOTPEmail(email, otp, "Account Verification");

    return res.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// 🔥 REGISTER USER
//////////////////////////////////////////////////////
export const registerUser = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const cleanEmail = email?.toLowerCase().trim();

    // Look for pending registration
    const pending = await PendingRegistration.findOne({ email: cleanEmail });

    if (!pending) {
      return res.status(400).json({
        success: false,
        message: "OTP expired or invalid",
      });
    }

    if (pending.otpExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    if (pending.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // 🔥 Anti-Race Condition Check
    const existingFinalUser = await userModel.findOne({
      $or: [{ email: pending.email }, { username: pending.username }],
    });

    if (existingFinalUser) {
      await PendingRegistration.deleteOne({ email: cleanEmail });
      return res.status(409).json({
        success: false,
        message: "User already exists. Please login.",
      });
    }

    // Password is already hashed from the OTP step
    const hashedPassword = pending.password;

    // Create the final user safely without empty/null constraints
    const user = await userModel.create({
      email: pending.email,
      username: pending.username,
      password: hashedPassword,
      name: pending.name,
      dob: pending.dob,
      role: detectRole(pending.email),
    });

    // Cleanup pending registration cache
    await PendingRegistration.deleteOne({ email: cleanEmail });

    const token = createToken(user._id, user.role);

    // Clean response (Do not send password hash)
    const safeUser = { ...user.toObject(), password: undefined };

    return res.json({
      success: true,
      token,
      user: safeUser,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// 🔐 LOGIN
//////////////////////////////////////////////////////
export const loginUser = async (req, res) => {
  try {
    const { identity, password } = req.body;

    if (!identity || !password) {
      return res.status(400).json({ success: false, message: "Please enter email/username and password" });
    }

    const clean = identity.toLowerCase().trim();

    const user = await userModel.findOne({
      $or: [
        { email: clean },
        { username: { $regex: `^${clean}$`, $options: "i" } },
      ],
    });

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const match = await bcrypt.compare(password, user.password);

    if (!match) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const token = createToken(user._id, user.role);

    // Clean response (Do not send password hash)
    const safeUser = { ...user.toObject(), password: undefined };

    res.json({ success: true, token, user: safeUser });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// 🔑 FORGOT PASSWORD
//////////////////////////////////////////////////////
export const forgotPassword = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase().trim();

    const user = await userModel.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    await sendOtp(email);

    res.json({ success: true, message: "OTP sent to email" });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// ✅ VERIFY OTP
//////////////////////////////////////////////////////
export const verifyOtpController = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase().trim();
    const { otp } = req.body;

    const response = await verifyOtp(email, otp);

    const message =
      typeof response === "string"
        ? response
        : response?.message || response?.data;

    if (message === "OTP verified") {
      await userModel.updateOne(
        { email },
        { $set: { resetOTP: "VERIFIED" } }
      );

      return res.json({ success: true, message: "OTP verified" });
    }

    return res.status(400).json({
      success: false,
      message: message || "Verification failed",
    });

  } catch (error) {
    console.error("VERIFY ERROR:", error?.response?.data || error);

    return res.status(400).json({
      success: false,
      message:
        error?.response?.data?.message ||
        error?.response?.data ||
        "Verification failed",
    });
  }
};

//////////////////////////////////////////////////////
// 🔁 RESET PASSWORD
//////////////////////////////////////////////////////
export const resetPassword = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase().trim();
    const { newPassword } = req.body;

    // Validate new password length
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const user = await userModel.findOne({ email });

    if (!user || user.resetOTP !== "VERIFIED") {
      return res.status(400).json({ success: false, message: "Verify OTP first" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOTP = null;

    await user.save();

    res.json({ success: true, message: "Password updated successfully" });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// 👤 CURRENT USER
//////////////////////////////////////////////////////
export const getCurrentUser = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};