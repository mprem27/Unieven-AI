import userModel from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import validator from "validator";
import { sendOTPEmail } from "../utils/sendEmail.js";

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
// 🔥 SEND REGISTER OTP (FIXED - NO USER CREATION)
//////////////////////////////////////////////////////
export const sendRegisterOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email" });
    }

    const emailLower = email.toLowerCase();
    const type = getEmailType(emailLower);

    if (type === "normal") {
      return res.status(400).json({
        success: false,
        message: "OTP not required for this email",
      });
    }

    const existing = await userModel.findOne({ email: emailLower });

    if (existing && existing.password) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOTP = await bcrypt.hash(otp, 10);

    // ✅ only update existing user
    if (existing) {
      existing.registerOTP = hashedOTP;
      existing.otpExpires = Date.now() + 5 * 60 * 1000;
      await existing.save();
    }
    // ❌ DO NOT create user here

    await sendOTPEmail(emailLower, otp, "Account Verification");

    res.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// 🔥 REGISTER USER (FINAL FIXED)
//////////////////////////////////////////////////////
export const registerUser = async (req, res) => {
  try {
    let { username, email, password, name, phone, otp, dob } = req.body;

    // 🔥 NORMALIZE INPUT
    username = username?.toLowerCase().trim();
    email = email?.toLowerCase().trim();

    // 🔥 STRONG VALIDATION
    if (!username || username === "") {
      return res.status(400).json({
        success: false,
        message: "Username is required",
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email",
      });
    }

    // ======================
    // EMAIL CHECK
    // ======================
    let user = await userModel.findOne({ email });

    if (user && user.password) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    // ======================
    // USERNAME CHECK (CASE SAFE)
    // ======================
    const existingUsername = await userModel.findOne({
      username: { $regex: `^${username}$`, $options: "i" },
    });

    if (existingUsername && existingUsername.email !== email) {
      return res.status(400).json({
        success: false,
        message: "Username already taken",
      });
    }

    const type = getEmailType(email);
    const role = detectRole(email);

    // ======================
    // OTP CHECK
    // ======================
    if (type === "faculty" || type === "collegeStudent") {
      if (!otp) {
        return res.status(400).json({
          success: false,
          message: "OTP required",
        });
      }

      if (!user || !user.registerOTP || user.otpExpires < Date.now()) {
        return res.status(400).json({
          success: false,
          message: "OTP expired",
        });
      }

      const isOtpValid = await bcrypt.compare(otp, user.registerOTP);

      if (!isOtpValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP",
        });
      }
    }

    // ✅ CREATE USER ONLY HERE
    if (!user) user = new userModel({ email });

    const hashedPassword = await bcrypt.hash(password, 10);

    user.username = username;
    user.password = hashedPassword;
    user.name = name;
    user.phone = phone;
    user.role = role;
    if (dob) user.dob = dob;

    user.registerOTP = undefined;
    user.otpExpires = undefined;

    // ======================
    // 🔥 SAVE WITH SAFETY
    // ======================
    try {
      await user.save();
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return res.status(400).json({
          success: false,
          message: `${field} already exists`,
        });
      }
      throw error;
    }

    const token = createToken(user._id, user.role);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        username: user.username,
      },
    });
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

    const user = await userModel.findOne({
      $or: [
        { email: identity.toLowerCase() },
        { username: identity.toLowerCase() },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = createToken(user._id, user.role);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        username: user.username,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// 🔑 SEND RESET OTP
//////////////////////////////////////////////////////
export const sendResetOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await userModel.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const salt = await bcrypt.genSalt(10);
    user.resetOTP = await bcrypt.hash(otp, salt);
    user.otpExpires = Date.now() + 5 * 60 * 1000;

    await user.save();

    await sendOTPEmail(email, otp, "Password Reset");

    res.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// 🔁 RESET PASSWORD
//////////////////////////////////////////////////////
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await userModel.findOne({
      email: email.toLowerCase(),
    });

    if (!user || !user.resetOTP || user.otpExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired or not found",
      });
    }

    const isOtpValid = await bcrypt.compare(otp, user.resetOTP);

    if (!isOtpValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    user.resetOTP = undefined;
    user.otpExpires = undefined;

    await user.save();

    res.json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// 👤 GET CURRENT USER
//////////////////////////////////////////////////////
export const getCurrentUser = async (req, res) => {
  try {
    const user = await userModel
      .findById(req.user.id)
      .select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};