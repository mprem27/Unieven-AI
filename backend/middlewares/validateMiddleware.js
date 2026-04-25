export const validateRequest = (type) => {
  return (req, res, next) => {
    try {
      const body = req.body;

      const isEmpty = (val) =>
        val === undefined || val === null || val.toString().trim() === "";

      // ================= EMAIL (FOR OTP) =================
      if (type === "email") {
        if (isEmpty(body.email)) {
          return res.status(400).json({
            success: false,
            message: "Email is required",
          });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.email)) {
          return res.status(400).json({
            success: false,
            message: "Invalid email format",
          });
        }
      }

      // ================= AUTH (LOGIN) =================
      if (type === "auth") {
        const identity = body.identity || body.email;

        if (isEmpty(identity) || isEmpty(body.password)) {
          return res.status(400).json({
            success: false,
            message: "Email/Username and password are required",
          });
        }

        // 🔥 ONLY validate if it's email
        const isEmail = identity.includes("@");

        if (isEmail) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(identity)) {
            return res.status(400).json({
              success: false,
              message: "Invalid email format",
            });
          }
        }

        // normalize
        body.identity = identity.toLowerCase().trim();
      }

      // ================= REGISTER =================
      if (type === "register") {

        if (isEmpty(body.name)) {
          return res.status(400).json({
            success: false,
            message: "Full name is required",
          });
        }

        if (isEmpty(body.username) || body.username.length < 3) {
          return res.status(400).json({
            success: false,
            message: "Username must be at least 3 characters",
          });
        }

        if (isEmpty(body.email)) {
          return res.status(400).json({
            success: false,
            message: "Email is required",
          });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.email)) {
          return res.status(400).json({
            success: false,
            message: "Invalid email format",
          });
        }

        if (isEmpty(body.password) || body.password.length < 6) {
          return res.status(400).json({
            success: false,
            message: "Password must be at least 6 characters",
          });
        }

        // 🔥 OTP CHECK
        const email = body.email.toLowerCase();
        const isStudent = email.startsWith("vtu");
        const isFaculty = email.startsWith("tts");

        if ((isStudent || isFaculty) && isEmpty(body.otp)) {
          return res.status(400).json({
            success: false,
            message: "OTP verification required",
          });
        }

        if (isEmpty(body.dob)) {
          return res.status(400).json({
            success: false,
            message: "Date of birth is required",
          });
        }
      }

      // ================= EVENT =================
      if (type === "event") {
        if (isEmpty(body.title) || isEmpty(body.date) || isEmpty(body.time)) {
          return res.status(400).json({
            success: false,
            message: "Title, date, and time are required",
          });
        }
      }

      // ================= POST =================
      if (type === "post") {
        if (!req.file && isEmpty(body.media)) {
          return res.status(400).json({
            success: false,
            message: "Image or video is required",
          });
        }
      }

      // ================= REEL =================
      if (type === "reel") {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "Video file is required",
          });
        }
      }

      // ================= STORY =================
      if (type === "story") {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "Story media is required",
          });
        }
      }

      // ================= COMMENT =================
      if (type === "comment") {
        if (isEmpty(body.text)) {
          return res.status(400).json({
            success: false,
            message: "Comment cannot be empty",
          });
        }
      }

      next();

    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Validation failed",
      });
    }
  };
};