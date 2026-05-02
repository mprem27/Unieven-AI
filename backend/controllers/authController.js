import userModel from "../models/User.js";
import PendingRegistration from "../models/PendingRegistration.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import validator from "validator";
import { sendOTPEmail } from "../utils/sendEmail.js";
import { sendOtp, verifyOtp } from "../services/otpService.js";

// ======================================================
// 🔐 TOKEN GENERATION
// ======================================================
const createToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// ======================================================
// 🎓 ROLE DETECTION
// ======================================================
const detectRole = (email) => {
  const e = email.toLowerCase();
  if (e.startsWith("tts") && e.includes(".edu.in")) return "faculty";
  if (e.startsWith("vtu") && e.includes(".edu.in")) return "student";
  return "student"; 
};

// ======================================================
// 🔥 SEND REGISTER OTP (Node.js Logic)
// ======================================================
export const sendRegisterOTP = async (req, res) => {
  try {
    let { email, username, password, name, dob } = req.body;

    email = email?.toLowerCase().trim();
    username = username?.toLowerCase().trim();
    name = name?.trim();

    if (!email || !username || !password || !name || !dob) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    const [existingEmail, existingUsername] = await Promise.all([
      userModel.findOne({ email }),
      userModel.findOne({ username })
    ]);

    if (existingEmail) return res.status(409).json({ success: false, message: "Email already registered" });
    if (existingUsername) return res.status(409).json({ success: false, message: "Username already taken" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const securePendingPassword = await bcrypt.hash(password, 10);

    await PendingRegistration.findOneAndUpdate(
      { email },
      { email, username, password: securePendingPassword, name, dob, otp, otpExpires: Date.now() + 5 * 60 * 1000 },
      { upsert: true, new: true }
    );

    const mailResult = await sendOTPEmail(email, otp, "Account Verification");

    if (mailResult?.success === false) {
      return res.status(500).json({ success: false, message: "Failed to send OTP email" });
    }

    return res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================
// 🔥 REGISTER USER (Node.js Logic)
// ======================================================
export const registerUser = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const cleanEmail = email?.toLowerCase().trim();

    const pending = await PendingRegistration.findOne({ email: cleanEmail });

    if (!pending || pending.otp !== otp || pending.otpExpires < Date.now()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    const user = await userModel.create({
      email: pending.email,
      username: pending.username,
      password: pending.password,
      name: pending.name,
      dob: pending.dob,
      role: detectRole(pending.email),
    });

    await PendingRegistration.deleteOne({ email: cleanEmail });
    const token = createToken(user._id, user.role);
    const { password, ...safeUser } = user.toObject();

    return res.json({ success: true, token, user: safeUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================
// 🔐 LOGIN
// ======================================================
export const loginUser = async (req, res) => {
  try {
    const { identity, password } = req.body;
    if (!identity || !password) return res.status(400).json({ success: false, message: "Missing credentials" });

    const clean = identity.toLowerCase().trim();
    const user = await userModel.findOne({ $or: [{ email: clean }, { username: clean }] });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Invalid email/username or password" });
    }

    const token = createToken(user._id, user.role);
    const { password: _, ...safeUser } = user.toObject();
    res.json({ success: true, token, user: safeUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================
// 🔑 FORGOT PASSWORD (Calls Spring Boot via Service)
// ======================================================
export const forgotPassword = async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const user = await userModel.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Call Spring Boot service
    const result = await sendOtp(email);

    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ======================================================
// ✅ VERIFY OTP (Calls Spring Boot via Service)
// ======================================================
export const verifyOtpController = async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    const { otp } = req.body;

    if (!email || !otp) return res.status(400).json({ success: false, message: "Email and OTP required" });

    // Call Spring Boot service
    const response = await verifyOtp(email, otp);

    // If Spring Boot returns success, the DB field resetOTP is already "VERIFIED"
    if (response.success) {
      return res.json({ success: true, message: "OTP verified successfully" });
    }

    return res.status(400).json({ success: false, message: "Verification failed" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ======================================================
// 🔁 RESET PASSWORD (Node.js Logic + Spring DB Update)
// ======================================================
export const resetPassword = async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const user = await userModel.findOne({ email });

    // This check works because Spring Boot set resetOTP to "VERIFIED" in the DB
    if (!user || user.resetOTP !== "VERIFIED") {
      return res.status(400).json({ success: false, message: "Please verify OTP correctly first" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOTP = null; // Clear the verification status
    user.otpExpires = null;

    await user.save();

    res.json({ success: true, message: "Password updated successfully. You can now login." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================
// 👤 CURRENT USER
// ======================================================
export const getCurrentUser = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};