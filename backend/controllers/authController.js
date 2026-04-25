import userModel from "../models/User.js";
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
  return "student";
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
    const { email } = req.body;

    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    const emailLower = email.toLowerCase().trim();
    const existing = await userModel.findOne({ email: emailLower });

    if (existing && existing.password) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOTP = await bcrypt.hash(otp, 10);

    await userModel.updateOne(
      { email: emailLower },
      {
        $set: {
          email: emailLower,
          registerOTP: hashedOTP,
          otpExpires: Date.now() + 5 * 60 * 1000,
        },
      },
      { upsert: true }
    );

    await sendOTPEmail(emailLower, otp, "Account Verification");

    res.json({ success: true, message: "OTP sent successfully" });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// 🔥 REGISTER USER
//////////////////////////////////////////////////////
export const registerUser = async (req, res) => {
  try {
    let { username, email, password, name, phone, otp } = req.body;

    username = username?.toLowerCase().trim();
    email = email?.toLowerCase().trim();

    let user = await userModel.findOne({ email });

    if (user && user.password) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    // Check if username is taken by someone else
    const existingUsername = await userModel.findOne({ username });
    if (existingUsername && existingUsername.email !== email) {
      return res.status(400).json({ success: false, message: "Username already taken" });
    }

    if (user?.registerOTP) {
      if (user.otpExpires < Date.now()) {
        return res.status(400).json({ success: false, message: "OTP expired" });
      }

      const isValid = await bcrypt.compare(otp, user.registerOTP);
      if (!isValid) {
        return res.status(400).json({ success: false, message: "Invalid OTP" });
      }
    }

    if (!user) user = new userModel({ email });

    user.username = username;
    user.password = await bcrypt.hash(password, 10);
    user.name = name;
    user.phone = phone;
    user.role = detectRole(email);

    user.registerOTP = null;
    user.otpExpires = null;

    await user.save();

    const token = createToken(user._id, user.role);

    res.json({ success: true, token, user });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    res.json({ success: true, token, user });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// 🔑 FORGOT PASSWORD (SPRING)
//////////////////////////////////////////////////////
export const forgotPassword = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase().trim();

    const user = await userModel.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    await sendOtp(email);

    // Matching the string exactly so the React frontend triggers success
    res.json({ success: true, message: "OTP sent to email" });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// ✅ VERIFY OTP (CLEAN & SAFE FIX)
//////////////////////////////////////////////////////
export const verifyOtpController = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase().trim();
    const { otp } = req.body;

    const response = await verifyOtp(email, otp);

    // ✅ ALWAYS NORMALIZE RESPONSE
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