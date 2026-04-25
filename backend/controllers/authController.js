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

    res.json({
      success: true,
      message: "OTP sent successfully",
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// 🔥 REGISTER USER
//////////////////////////////////////////////////////
export const registerUser = async (req, res) => {
  try {
    let { username, email, password, name, phone, otp, dob } = req.body;

    username = username?.toLowerCase().trim();
    email = email?.toLowerCase().trim();

    if (!username) {
      return res.status(400).json({ success: false, message: "Username required" });
    }

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email" });
    }

    let user = await userModel.findOne({ email });

    if (user && user.password) {
      return res.status(400).json({ success: false, message: "Email exists" });
    }

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

    if (type !== "normal") {
      if (!otp || !user || !user.registerOTP || user.otpExpires < Date.now()) {
        return res.status(400).json({
          success: false,
          message: "OTP expired or missing",
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

    await user.save();

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
// 🔐 LOGIN (FIXED FOR EMAIL + USERNAME)
//////////////////////////////////////////////////////
export const loginUser = async (req, res) => {
  try {
    const { identity, password } = req.body;

    if (!identity || !password) {
      return res.status(400).json({
        success: false,
        message: "Please enter email/username and password",
      });
    }

    const cleanIdentity = identity.toLowerCase().trim();

    // 🔥 FIX: supports both email + username
    const user = await userModel.findOne({
      $or: [
        { email: cleanIdentity },
        { username: { $regex: `^${cleanIdentity}$`, $options: "i" } },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 🔐 check password
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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
//////////////////////////////////////////////////////
// 🔑 FORGOT PASSWORD (Spring)
//////////////////////////////////////////////////////
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await userModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await sendOtp(email);

    res.json({ success: true, message: "OTP sent successfully" });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// ✅ VERIFY OTP (FIXED)
//////////////////////////////////////////////////////
export const verifyOtpController = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const response = await verifyOtp(email, otp);

    if (response.data === "OTP verified") {

      const user = await userModel.findOne({
        email: email.toLowerCase(),
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // 🔥 IMPORTANT FIX
      user.resetOTP = "VERIFIED";
      await user.save();

      return res.json({
        success: true,
        message: "OTP verified",
      });
    }

    return res.status(400).json({
      success: false,
      message: response.data,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Verification failed",
    });
  }
};

//////////////////////////////////////////////////////
// 🔁 RESET PASSWORD (FIXED)
//////////////////////////////////////////////////////
export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const user = await userModel.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 🔥 MUST VERIFY FIRST
    if (user.resetOTP !== "VERIFIED") {
      return res.status(400).json({
        success: false,
        message: "Verify OTP first",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;

    // Clear OTP
    user.resetOTP = null;
    user.otpExpires = null;

    await user.save();

    res.json({
      success: true,
      message: "Password updated successfully",
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// 👤 CURRENT USER
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