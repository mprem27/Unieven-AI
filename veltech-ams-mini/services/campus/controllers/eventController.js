import { canManageEvent } from "../campus/policy.js";
import { checkIn, registerForEvent as secureRegister } from "../campus/services/registration.js";
import User from "../models/User.js";
import eventModel from "../models/Event.js";
import EventRegistration from "../models/EventRegistration.js";
import userModel from "../models/User.js";
import cloudinary from "../configs/cloudinary.js";
import QRCode from "qrcode";
import crypto from "crypto";
import { Parser } from "json2csv";
import { uploadFromBuffer } from "../utils/uploadToCloudinary.js"; // 🔥 STEP 1

// ============================================
// CREATE EVENT
// ============================================
export const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      date,
      time,
      location,
      category,
      maxParticipants,
    } = req.body;

    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Event poster is required",
      });
    }

    // 🔥 STEP 3: NEW BUFFER UPLOAD LOGIC
    let upload;

    try {
      upload = await uploadFromBuffer(file.buffer, "unieven_events");
    } catch (err) {
      console.error("Cloudinary Buffer Upload Error:", err);
      return res.status(500).json({
        success: false,
        message: "Image upload failed",
      });
    }

    const newEvent = await eventModel.create({
      createdBy: req.user.id,
      title: title.trim(),
      description: description?.trim() || "",
      image: upload.secure_url,
      date: new Date(date),
      time: time.trim(),
      location: location.trim(),
      category: category || "General",
      status: "upcoming",
      attendees: [],
      maxParticipants: Number(maxParticipants) || null,
    });

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      event: newEvent,
    });
  } catch (error) {
    console.error("createEvent error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// GET ALL EVENTS
// ============================================
export const getAllEvents = async (req, res) => {
  try {
    const currentDate = new Date();

    await eventModel.updateMany(
      {
        date: {
          $lt: currentDate,
        },
        status: "upcoming",
      },
      {
        $set: {
          status: "completed",
        },
      }
    );

    const events = await eventModel
      .find({})
      .populate("createdBy", "username image role")
      .sort({
        date: 1,
      });

    res.json({
      success: true,
      events,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// GET SINGLE EVENT
// ============================================
export const getSingleEvent = async (req, res) => {
  try {
    const event = await eventModel
      .findById(req.params.id)
      .populate("createdBy", "username image role")
      .populate("attendees", "username image");

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const recommendedEvents = await eventModel
      .find({
        category: event.category,
        _id: {
          $ne: event._id,
        },
        status: "upcoming",
      })
      .populate("createdBy", "username image")
      .limit(3)
      .sort({
        date: 1,
      });

    res.json({
      success: true,
      event,
      recommendedEvents,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// REGISTER / JOIN EVENT WITH QR
// ============================================
export const registerForEvent = async (req, res) => {
  try {
    const event = await eventModel.findById(req.params.id);
    if (!event) return res.status(404).json({success:false,message:"Event not found"});
    if (event.pricePaise > 0) return res.status(409).json({success:false,message:"Use UniEve Campus to pay for this event"});
    const user = await User.findById(req.user.id);
    const registration = await secureRegister(user, event.id, {}, req.body);
    return res.json({success:true,message:"Registered successfully",registration});
  } catch (error) { return res.status(error.status || 500).json({success:false,message:error.message}); }
};

export const verifyAttendanceQR = async (req, res) => {
  try {
    const parsed = typeof req.body.qrData === "string" ? JSON.parse(req.body.qrData) : req.body.qrData;
    if (!parsed?.registrationId || !parsed?.qrToken) return res.status(400).json({success:false,message:"Invalid QR data"});
    const registration = await checkIn(req.user, parsed.registrationId, parsed.qrToken);
    return res.json({success:true,message:"Attendance verified",registration});
  } catch (error) { return res.status(error instanceof SyntaxError ? 400 : error.status || 500).json({success:false,message:error.message}); }
};

export const getEventParticipants = async (req, res) => {
  try {
    const event = await eventModel.findById(req.params.id);
    if (!canManageEvent(req.user, event)) return res.status(403).json({success:false,message:"Organizer access required for this event"});
    const participants = await EventRegistration.find({
      event: req.params.id,
    })
      .populate("user", "username email image")
      .sort({
        createdAt: -1,
      });

    res.json({
      success: true,
      participants,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// EVENT ANALYTICS
// ============================================
export const getEventAnalytics = async (req, res) => {
  try {
    const event = await eventModel.findById(req.params.id);
    if (!canManageEvent(req.user, event)) return res.status(403).json({success:false,message:"Organizer access required for this event"});
    const registrations = await EventRegistration.find({
      event: req.params.id,
    });

    const totalRegistered = registrations.length;

    const totalAttended = registrations.filter(
      (r) => r.status === "attended"
    ).length;

    const attendanceRate =
      totalRegistered > 0
        ? ((totalAttended / totalRegistered) * 100).toFixed(2)
        : 0;

    const departmentStats = {};

    registrations.forEach((r) => {
      departmentStats[r.department] =
        (departmentStats[r.department] || 0) + 1;
    });

    res.json({
      success: true,
      analytics: {
        totalRegistered,
        totalAttended,
        attendanceRate,
        departmentStats,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// EXPORT CSV
// ============================================
export const exportParticipantsCSV = async (req, res) => {
  try {
    const event = await eventModel.findById(req.params.id);
    if (!canManageEvent(req.user, event)) return res.status(403).json({success:false,message:"Organizer access required for this event"});
    const participants = await EventRegistration.find({
      event: req.params.id,
    }).populate("user", "username email");

    const csvData = participants.map((p) => ({
      Name: p.user?.username,
      Email: p.user?.email,
      StudentID: p.studentId,
      Department: p.department,
      Phone: p.phone,
      Status: p.status,
      RegisteredAt: p.createdAt,
      AttendanceTime: p.attendanceTime,
    }));

    const parser = new Parser();
    const csv = parser.parse(csvData);

    res.header("Content-Type", "text/csv");
    res.attachment("participants.csv");

    return res.send(csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// DELETE EVENT
// ============================================
export const deleteEvent = async (req, res) => {
  try {
    const event = await eventModel.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (
      !canManageEvent(req.user, event)
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (event.pricePaise > 0 || await EventRegistration.exists({event:event._id,$or:[{paymentOrderId:{$exists:true}},{amountPaise:{$gt:0}},{paymentId:{$gt:""}}]})) {
      return res.status(409).json({success:false,message:"Paid events and payment receipts must be retained. Contact the organizer to cancel and arrange refunds."});
    }

    if (event.image) {
      try {
        const publicId = event.image.split("/").pop().split(".")[0];

        await cloudinary.uploader.destroy(`unieven_events/${publicId}`);
      } catch (err) {
        console.log("Cloudinary delete error:", err.message);
      }
    }
    await EventRegistration.deleteMany({
      event: event._id,
    });
    await eventModel.findByIdAndDelete(event._id);

    res.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
