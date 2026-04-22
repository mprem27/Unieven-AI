import { v2 as cloudinary } from "cloudinary";
import fs from "fs";


// 🔥 HELPER: SAFE DELETE
const removeLocalFile = (path) => {
  if (path && fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
};


// --- 1. UPLOAD IMAGE ---
export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image provided",
      });
    }

    // 🔐 VALIDATE IMAGE TYPE
    if (!req.file.mimetype.startsWith("image")) {
      removeLocalFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Only image files allowed",
      });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "unieven/images",
      resource_type: "image",
      transformation: [
        { quality: "auto", fetch_format: "auto" }, // optimize
      ],
    });

    removeLocalFile(req.file.path);

    res.json({
      success: true,
      message: "Image uploaded",
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
    });

  } catch (error) {
    if (req.file) removeLocalFile(req.file.path);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// --- 2. UPLOAD VIDEO ---
export const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No video provided",
      });
    }

    // 🔐 VALIDATE VIDEO TYPE
    if (!req.file.mimetype.startsWith("video")) {
      removeLocalFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Only video files allowed",
      });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "unieven/videos",
      resource_type: "video",
      transformation: [
        { quality: "auto", fetch_format: "auto" }, // compression
      ],
    });

    removeLocalFile(req.file.path);

    res.json({
      success: true,
      message: "Video uploaded",
      url: result.secure_url,
      duration: result.duration,
      public_id: result.public_id,
    });

  } catch (error) {
    if (req.file) removeLocalFile(req.file.path);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};