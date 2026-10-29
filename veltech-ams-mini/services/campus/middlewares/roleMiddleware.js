
export const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // 1. Ensure authMiddleware already ran
      if (!req.user || !req.user.role) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // 2. Normalize roles (lowercase safety)
      const userRole = req.user.role.toLowerCase();
      const roles = allowedRoles.map((r) => r.toLowerCase());

      //  3. Check permission
      if (!roles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Allowed roles: ${roles.join(", ")}`,
        });
      }

      // 4. Authorized
      next();

    } catch (error) {
      console.error("Role Middleware Error:", error.message);

      res.status(500).json({
        success: false,
        message: "Role verification failed",
      });
    }
  };
};