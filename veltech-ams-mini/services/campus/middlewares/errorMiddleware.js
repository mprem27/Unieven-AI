
const errorMiddleware = (err, req, res, next) => {
  // DEFAULT VALUES
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";



  // Invalid ObjectId
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}`;
  }

  // Duplicate key (username/email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    statusCode = 400;
    message = `${field} already exists`;
  }

  // Validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

 

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Session expired. Please login again";
  }



  if (err.name === "MulterError") {
    statusCode = 400;
    message = err.message;
  }



  if (err.isOperational) {
    message = err.message;
  }


  if (process.env.NODE_ENV === "development") {
    console.error(" ERROR:", err);
  }



  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export default errorMiddleware;