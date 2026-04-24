import rateLimit, { ipKeyGenerator } from "express-rate-limit";

//  COMMON HANDLER
const limiterHandler = (req, res) => {
  res.status(429).json({
    success: false,
    message: "Too many requests. Please slow down.",
  });
};

//  SAFE KEY GENERATOR (FIXED)
const keyGenerator = (req) => {
  // ❗ BEFORE LOGIN → use SAFE IP handler
  if (!req.user) return ipKeyGenerator(req);

  //  AFTER LOGIN → use USER ID
  return req.user.id;
};

//  SKIP TRUSTED USERS
const skipForTrustedUsers = (req) => {
  return req.user?.role === "admin" || req.user?.role === "faculty";
};


export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 50,
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

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  skip: skipForTrustedUsers,
  handler: limiterHandler,
});