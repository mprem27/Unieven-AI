export const validateRequest = (type) => {
  return (req, res, next) => {
    try {
      const body = req.body;

      const isEmpty = (val) =>
        val === undefined || val === null || val.toString().trim() === "";

      // =====================================================
      // 📧 EMAIL VALIDATION
      // =====================================================
      if (type === "email") {
        if (isEmpty(body.email)) {
          return res.status(400).json({ success: false, message: "Email is required" });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.email)) {
          return res.status(400).json({ success: false, message: "Invalid email format" });
        }

        body.email = body.email.toLowerCase().trim();
      }

      // =====================================================
      // 🔐 AUTH (LOGIN) VALIDATION
      // =====================================================
      if (type === "auth") {
        const identity = body.identity || body.email;

        if (isEmpty(identity) || isEmpty(body.password)) {
          return res.status(400).json({
            success: false,
            message: "Email/Username and password are required",
          });
        }

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

        body.identity = identity.toLowerCase().trim();
      }

      // =====================================================
      // 📩 SEND OTP VALIDATION (Full Details)
      // =====================================================
      if (type === "send-otp") {
        // FULL NAME
        if (isEmpty(body.name)) {
          return res.status(400).json({ success: false, message: "Full name is required" });
        }

        // USERNAME
        if (isEmpty(body.username) || body.username.length < 3) {
          return res.status(400).json({
            success: false,
            message: "Username must be at least 3 characters",
          });
        }

        const usernameRegex = /^[a-z0-9._]{3,20}$/;
        if (!usernameRegex.test(body.username)) {
          return res.status(400).json({
            success: false,
            message: "Username can only contain lowercase letters, numbers, dots, and underscores",
          });
        }
        body.username = body.username.toLowerCase().trim();

        // EMAIL
        if (isEmpty(body.email)) {
          return res.status(400).json({ success: false, message: "Email is required" });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.email)) {
          return res.status(400).json({ success: false, message: "Invalid email format" });
        }
        body.email = body.email.toLowerCase().trim();

        // PASSWORD
        if (isEmpty(body.password) || body.password.length < 6) {
          return res.status(400).json({
            success: false,
            message: "Password must be at least 6 characters",
          });
        }

        // DOB
        if (isEmpty(body.dob)) {
          return res.status(400).json({ success: false, message: "Date of birth is required" });
        }
      }

      // =====================================================
      // 🚀 FINAL REGISTER VALIDATION (Email + OTP only)
      // =====================================================
      if (type === "register") {
        if (isEmpty(body.email)) {
          return res.status(400).json({ success: false, message: "Email is required" });
        }
        
        body.email = body.email.toLowerCase().trim();

        if (isEmpty(body.otp)) {
          return res.status(400).json({ success: false, message: "OTP is required" });
        }
      }

      // =====================================================
      // 📅 EVENT VALIDATION
      // =====================================================
      if (type === "event") {
        if (isEmpty(body.title) || isEmpty(body.date) || isEmpty(body.time)) {
          return res.status(400).json({
            success: false,
            message: "Title, date, and time are required",
          });
        }
      }

      // =====================================================
      // 📸 POST VALIDATION
      // =====================================================
      if (type === "post") {
        if (!req.file && isEmpty(body.media)) {
          return res.status(400).json({
            success: false,
            message: "Image or video is required",
          });
        }
      }

      // =====================================================
      // 🎬 REEL VALIDATION
      // =====================================================
      if (type === "reel") {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "Video file is required",
          });
        }
      }

      // =====================================================
      // 📖 STORY VALIDATION
      // =====================================================
      if (type === "story") {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "Story media is required",
          });
        }
      }

      // =====================================================
      // 💬 COMMENT VALIDATION
      // =====================================================
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
      console.error("VALIDATION ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Validation failed",
      });
    }
  };
};