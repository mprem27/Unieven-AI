export const validateRequest = (type) => {
  return (req, res, next) => {
    try {
      const body = req.body;

      // Helper to check if a field is truly empty
      const isEmpty = (val) =>
        val === undefined ||
        val === null ||
        String(val).trim() === "";

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const usernameRegex = /^[a-z0-9._]{3,20}$/;

      // 1. Forgot Password Step 1 (Email only)
      if (type === "email") {
        if (isEmpty(body.email)) {
          return res.status(400).json({ success: false, message: "Email is required" });
        }
        if (!emailRegex.test(String(body.email))) {
          return res.status(400).json({ success: false, message: "Invalid email format" });
        }
        body.email = String(body.email).toLowerCase().trim();
      }

      // 2. Login Validation (Email or Username)
      if (type === "auth") {
        const identity = body.identity || body.email;
        if (isEmpty(identity) || isEmpty(body.password)) {
          return res.status(400).json({ success: false, message: "Credentials are required" });
        }
        const stringIdentity = String(identity).toLowerCase().trim();
        if (stringIdentity.includes("@") && !emailRegex.test(stringIdentity)) {
          return res.status(400).json({ success: false, message: "Invalid email format" });
        }
        body.identity = stringIdentity;
      }

      // 3. Registration Step 1 (Send OTP)
      if (type === "sendRegisterOtp") {
        if (isEmpty(body.name)) return res.status(400).json({ success: false, message: "Full name is required" });

        const username = String(body.username || "");
        if (isEmpty(username) || !usernameRegex.test(username.toLowerCase().trim())) {
          return res.status(400).json({ success: false, message: "Username: 3–20 chars (a-z, 0-9, ., _)" });
        }

        if (isEmpty(body.email) || !emailRegex.test(String(body.email).toLowerCase().trim())) {
          return res.status(400).json({ success: false, message: "Valid email is required" });
        }

        if (isEmpty(body.password) || String(body.password).length < 6) {
          return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
        }

        if (isEmpty(body.dob)) return res.status(400).json({ success: false, message: "Date of birth is required" });

        // Apply Sanitization
        body.username = username.toLowerCase().trim();
        body.email = String(body.email).toLowerCase().trim();
      }

      // 4. Registration Step 2 (Verify & Create User)
      if (type === "register") {
        if (isEmpty(body.email) || isEmpty(body.otp)) {
          return res.status(400).json({ success: false, message: "Email and OTP are required" });
        }
        body.email = String(body.email).toLowerCase().trim();
        body.otp = String(body.otp).trim();
      }

      // 5. Forgot Password Step 2 (Verify OTP via Spring Bridge)
      if (type === "verifyOtp") {
        if (isEmpty(body.email) || isEmpty(body.otp)) {
          return res.status(400).json({ success: false, message: "Email and OTP are required" });
        }
        body.email = String(body.email).toLowerCase().trim();
        body.otp = String(body.otp).trim();
      }

      // 6. Forgot Password Step 3 (Final Reset)
      if (type === "resetPassword") {
        if (isEmpty(body.email)) return res.status(400).json({ success: false, message: "Email is required" });
        if (isEmpty(body.newPassword) || String(body.newPassword).length < 6) {
          return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
        }
        body.email = String(body.email).toLowerCase().trim();
      }

      // --- Social / Content Validations ---
      if (type === "post") {
        if (!req.file && isEmpty(body.media)) {
          return res.status(400).json({ success: false, message: "Media (image/video) is required" });
        }
      }

      if (type === "reel" || type === "story") {
        if (!req.file) {
          return res.status(400).json({ success: false, message: "Video/Media file is required" });
        }
      }

      if (type === "comment" && isEmpty(body.text)) {
        return res.status(400).json({ success: false, message: "Comment cannot be empty" });
      }

      return next();
    } catch (error) {
      console.error("MIDDLEWARE VALIDATION ERROR:", error);
      return res.status(500).json({ success: false, message: "Internal validation error" });
    }
  };
};