import rateLimit from "express-rate-limit";

// 🔥 COMMON HANDLER
const limiterHandler = (req, res) => {
  res.status(429).json({
    success: false,
    message: "Too many requests. Please slow down.",
  });
};

// 🔥 SAFE KEY GENERATOR
const keyGenerator = (req) => {
  // ❗ BEFORE LOGIN → use IP
  if (!req.user) return req.ip;

  // ✅ AFTER LOGIN → use USER ID
  return req.user.id;
};

// 🔥 SKIP TRUSTED USERS
const skipForTrustedUsers = (req) => {
  return req.user?.role === "admin" || req.user?.role === "faculty";
};

// -----------------------------
// 🔐 AUTH LIMITER (LOGIN / REGISTER)
// -----------------------------
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 🔥 reduced to 5 min
  max: 50, // 🔥 increased (fix 429 issue)
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  skip: skipForTrustedUsers,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many login attempts. Try again after some time.",
    });
  },
});

// -----------------------------
// 👥 FOLLOW LIMITER
// -----------------------------
export const followLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator,
  skip: skipForTrustedUsers,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "You're following too fast. Please wait.",
    });
  },
});

// -----------------------------
// 💬 COMMENT LIMITER
// -----------------------------
export const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator,
  skip: skipForTrustedUsers,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many comments. Slow down.",
    });
  },
});

// -----------------------------
// 📸 POST / REEL LIMITER
// -----------------------------
export const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator,
  skip: skipForTrustedUsers,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many uploads. Please wait.",
    });
  },
});

// -----------------------------
// 🌐 GLOBAL API LIMITER
// -----------------------------
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // 🔥 increased
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  skip: skipForTrustedUsers,
  handler: limiterHandler,
});