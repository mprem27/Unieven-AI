import multer from "multer";
import path from "path";

// =============================
// 📦 MEMORY STORAGE (FIX FOR RENDER)
// =============================
// Keeps the file in memory as a Buffer instead of writing to disk.
const storage = multer.memoryStorage();

// =============================
// 🔥 UNIVERSAL FILE FILTER
// =============================
const fileFilter = (req, file, cb) => {
  const allowedImage = /jpeg|jpg|png|webp/;
  const allowedVideo = /mp4|mov|mkv/;

  // Get extension with dot (e.g., '.png')
  const ext = path.extname(file.originalname).toLowerCase();

  // Validate both extension and mimetype to prevent spoofing
  const isImage =
    allowedImage.test(ext) &&
    allowedImage.test(file.mimetype);

  const isVideo =
    allowedVideo.test(ext) &&
    allowedVideo.test(file.mimetype);

  if (isImage || isVideo) {
    cb(null, true);
  } else {
    cb(new Error("Only image or video files are allowed"));
  }
};

// =============================
// 📤 IMAGE UPLOAD
// =============================
export const uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
});

// =============================
// 📤 VIDEO UPLOAD
// =============================
export const uploadVideo = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter,
});

// =============================
// 📤 MIXED UPLOAD (FOR STORIES / POSTS)
// =============================
export const uploadAny = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter,
});

// =============================
// ❌ MULTER ERROR HANDLER
// =============================
export const multerErrorHandler = (err, req, res, next) => {
  console.error("MULTER ERROR:", err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "File upload error",
    });
  }

  next();
};