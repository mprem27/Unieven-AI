import multer from "multer";
import path from "path";
import fs from "fs";

// =============================
// 📂 CREATE UPLOAD FOLDER
// =============================
const uploadDir = "uploads/";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// =============================
// 📦 STORAGE CONFIG
// =============================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(null, uniqueName + path.extname(file.originalname));
  },
});

// =============================
// 🔥 UNIVERSAL FILE FILTER (FIX)
// =============================
const fileFilter = (req, file, cb) => {
  const allowedImage = /jpeg|jpg|png|webp/;
  const allowedVideo = /mp4|mov|mkv/;

  const ext = path.extname(file.originalname).toLowerCase();

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
// 📤 MIXED UPLOAD (FIXED)
// =============================
export const uploadAny = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter, // 🔥 IMPORTANT FIX
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