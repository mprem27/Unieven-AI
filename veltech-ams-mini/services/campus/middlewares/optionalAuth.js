import jwt from "jsonwebtoken";
import userModel from "../models/User.js";

/**
 * 🔓 OPTIONAL AUTH MIDDLEWARE
 * Works for both:
 * - Logged-in users
 * - Guests (no token)
 */
const optionalAuth = async (req, res, next) => {
  try {
    // 🔑 Get token (support both header formats)
    const token =
      req.headers.token ||
      req.headers.authorization?.replace("Bearer ", "");

    // 👉 If no token → continue as guest
    if (!token) {
      req.user = null;
      return next();
    }

    // 🔍 Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔐 Check if user exists in DB
    const user = await userModel.findById(decoded.id).select("_id role");

    if (!user) {
      req.user = null;
      return next();
    }

    // ✅ Attach user to request
    req.user = {
      id: user._id,
      role: user.role,
    };

    next();
  } catch (error) {
    
    req.user = null;
    next();
  }
};

export default optionalAuth;