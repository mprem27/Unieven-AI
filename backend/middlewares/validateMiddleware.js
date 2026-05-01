export const validateRequest = (type) => {
  return (req, res, next) => {
    try {
      const body = req.body;

 
      const isEmpty = (val) =>
        val === undefined ||
        val === null ||
        String(val).trim() === "";

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const usernameRegex = /^[a-z0-9._]{3,20}$/;

    
      if (type === "email") {
        if (isEmpty(body.email)) {
          return res.status(400).json({
            success: false,
            message: "Email is required",
          });
        }

        if (!emailRegex.test(String(body.email))) {
          return res.status(400).json({
            success: false,
            message: "Invalid email format",
          });
        }

        body.email = String(body.email).toLowerCase().trim();
      }

    
      if (type === "auth") {
        const identity = body.identity || body.email;

        if (isEmpty(identity) || isEmpty(body.password)) {
          return res.status(400).json({
            success: false,
            message: "Email/Username and password are required",
          });
        }

        const stringIdentity = String(identity);

        if (stringIdentity.includes("@") && !emailRegex.test(stringIdentity)) {
          return res.status(400).json({
            success: false,
            message: "Invalid email format",
          });
        }

        body.identity = stringIdentity.toLowerCase().trim();
      }

 
      if (type === "sendRegisterOtp") {
        // FULL NAME
        if (isEmpty(body.name)) {
          return res.status(400).json({
            success: false,
            message: "Full name is required",
          });
        }

        // USERNAME
        const stringUsername = String(body.username || "");
        if (isEmpty(body.username) || !usernameRegex.test(stringUsername)) {
          return res.status(400).json({
            success: false,
            message: "Username must be 3–20 characters using lowercase letters, numbers, dots, or underscores",
          });
        }
        body.username = stringUsername.toLowerCase().trim();

        // EMAIL
        if (isEmpty(body.email)) {
          return res.status(400).json({
            success: false,
            message: "Email is required",
          });
        }

        if (!emailRegex.test(String(body.email))) {
          return res.status(400).json({
            success: false,
            message: "Invalid email format",
          });
        }
        body.email = String(body.email).toLowerCase().trim();

        // PASSWORD
        if (isEmpty(body.password) || String(body.password).length < 6) {
          return res.status(400).json({
            success: false,
            message: "Password must be at least 6 characters",
          });
        }

        // DOB
        if (isEmpty(body.dob)) {
          return res.status(400).json({
            success: false,
            message: "Date of birth is required",
          });
        }
      }

     
      if (type === "register") {
        if (isEmpty(body.email)) {
          return res.status(400).json({
            success: false,
            message: "Email is required",
          });
        }

        if (!emailRegex.test(String(body.email))) {
          return res.status(400).json({
            success: false,
            message: "Invalid email format",
          });
        }
        body.email = String(body.email).toLowerCase().trim();

        if (isEmpty(body.otp)) {
          return res.status(400).json({
            success: false,
            message: "OTP is required",
          });
        }
      }

  
      if (type === "verifyOtp") {
        if (isEmpty(body.email)) {
          return res.status(400).json({
            success: false,
            message: "Email is required",
          });
        }

        if (!emailRegex.test(String(body.email))) {
          return res.status(400).json({
            success: false,
            message: "Invalid email format",
          });
        }
        body.email = String(body.email).toLowerCase().trim();

        if (isEmpty(body.otp)) {
          return res.status(400).json({
            success: false,
            message: "OTP is required",
          });
        }
      }

   
      if (type === "resetPassword") {
        if (isEmpty(body.email)) {
          return res.status(400).json({
            success: false,
            message: "Email is required",
          });
        }

        if (!emailRegex.test(String(body.email))) {
          return res.status(400).json({
            success: false,
            message: "Invalid email format",
          });
        }
        body.email = String(body.email).toLowerCase().trim();

        if (isEmpty(body.newPassword) || String(body.newPassword).length < 6) {
          return res.status(400).json({
            success: false,
            message: "New password must be at least 6 characters",
          });
        }
      }

   
      if (type === "event") {
        if (isEmpty(body.title) || isEmpty(body.date) || isEmpty(body.time)) {
          return res.status(400).json({
            success: false,
            message: "Title, date, and time are required",
          });
        }
      }


      if (type === "post") {
        if (!req.file && isEmpty(body.media)) {
          return res.status(400).json({
            success: false,
            message: "Image or video is required",
          });
        }
      }

 
      if (type === "reel") {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "Video file is required",
          });
        }
      }

      if (type === "story") {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "Story media is required",
          });
        }
      }

      if (type === "comment") {
        if (isEmpty(body.text)) {
          return res.status(400).json({
            success: false,
            message: "Comment cannot be empty",
          });
        }
      }

      return next();
    } catch (error) {
      console.error("VALIDATION ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Validation failed",
      });
    }
  };
};