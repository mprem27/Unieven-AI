

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      // Optional: add request info for debugging
      if (process.env.NODE_ENV === "development") {
        console.error("Async Error:", err.message);
      }
      next(err);
    });
  };
};

export default asyncHandler;