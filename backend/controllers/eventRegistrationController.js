import eventRegistrationModel from "../models/EventRegistration.js";
import eventModel from "../models/Event.js";
import notificationModel from "../models/Notification.js";
import QRCode from "qrcode";
import crypto from "crypto";
import { Parser } from "json2csv";

// ==================================================
// 1️⃣ REGISTER / UNREGISTER EVENT + QR GENERATION
// ==================================================
export const registerEvent = async (req, res) => {
  try {
    const {
      eventId,
      studentId,
      department,
      phone,
      // 🔥 NEW FIELDS ADDED HERE
      email,
      degree,
      yearOfStudy,
      collegeName,
    } = req.body;

    const userId = req.user.id;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required",
      });
    }

    const event = await eventModel.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // ==========================================
    // BLOCK COMPLETED EVENTS
    // ==========================================
    if (new Date(event.date) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Event already completed",
      });
    }

    // ==========================================
    // EXISTING REGISTRATION
    // ==========================================
    const existing = await eventRegistrationModel.findOne({
      user: userId,
      event: eventId,
    });

    // ==========================================
    // UNREGISTER
    // ==========================================
    if (existing) {
      await eventRegistrationModel.findByIdAndDelete(existing._id);

      await eventModel.findByIdAndUpdate(eventId, {
        $pull: {
          attendees: userId,
        },
      });

      return res.json({
        success: true,
        message: "Unregistered successfully",
      });
    }

    // ==========================================
    // VALIDATION (Added email as required)
    // ==========================================
    if (!studentId || !department || !phone || !email) {
      return res.status(400).json({
        success: false,
        message: "Student ID, email, department, and phone are required",
      });
    }

    // ==========================================
    // QR TOKEN
    // ==========================================
    const qrToken = crypto.randomBytes(16).toString("hex");

    // ==========================================
    // CREATE REGISTRATION
    // ==========================================
    const registration = await eventRegistrationModel.create({
      user: userId,
      event: eventId,
      studentId,
      email, // 🔥 NEW
      department,
      phone,
      degree, // 🔥 NEW
      yearOfStudy, // 🔥 NEW
      collegeName, // 🔥 NEW
      status: "registered",
      qrToken,
    });

    // ==========================================
    // QR CODE DATA
    // ==========================================
    const qrPayload = JSON.stringify({
      registrationId: registration._id,
      userId,
      eventId,
      qrToken,
    });

    registration.qrCode = await QRCode.toDataURL(qrPayload);

    await registration.save();

    // ==========================================
    // ADD TO ATTENDEES
    // ==========================================
    await eventModel.findByIdAndUpdate(eventId, {
      $addToSet: {
        attendees: userId,
      },
    });

    // ==========================================
    // NOTIFICATION
    // ==========================================
    if (event.createdBy && event.createdBy.toString() !== userId) {
      await notificationModel.create({
        toUser: event.createdBy,
        fromUser: userId,
        type: "event_registration",
        event: eventId,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Registered successfully",
      registration,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Already registered for this event",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================================================
// 2️⃣ MARK ATTENDANCE MANUALLY
// ==================================================
export const markAttendance = async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await eventRegistrationModel.findById(registrationId);

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    if (registration.status === "attended") {
      return res.status(400).json({
        success: false,
        message: "Already marked",
      });
    }

    registration.status = "attended";
    registration.attendanceTime = new Date();
    registration.checkInMethod = "manual";
    registration.attendanceMarkedBy = req.user.id;

    await registration.save();

    return res.json({
      success: true,
      message: "Attendance marked",
      registration,
    });
  } catch (error) {
    console.error("ATTENDANCE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================================================
// 3️⃣ VERIFY QR ATTENDANCE
// ==================================================
export const verifyEventQR = async (req, res) => {
  try {
    const { qrData } = req.body;

    const parsed = JSON.parse(qrData);

    const registration = await eventRegistrationModel
      .findOne({
        _id: parsed.registrationId,
        qrToken: parsed.qrToken,
      })
      .populate("user", "name username email image");

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Invalid QR code",
      });
    }

    if (registration.status === "attended") {
      return res.status(400).json({
        success: false,
        message: "Already attended",
      });
    }

    registration.status = "attended";
    registration.attendanceTime = new Date();
    registration.checkInMethod = "qr";
    registration.attendanceMarkedBy = req.user.id;

    await registration.save();

    return res.json({
      success: true,
      message: "QR verified successfully",
      participant: registration,
    });
  } catch (error) {
    console.error("QR VERIFY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "QR verification failed",
    });
  }
};

// ==================================================
// 4️⃣ GET USER EVENTS
// ==================================================
export const getUserEvents = async (req, res) => {
  try {
    const registrations = await eventRegistrationModel
      .find({
        user: req.user.id,
      })
      .populate({
        path: "event",
        select: "title date time location image createdBy category",
      })
      .sort({
        createdAt: -1,
      });

    return res.json({
      success: true,
      registrations,
    });
  } catch (error) {
    console.error("GET USER EVENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================================================
// 5️⃣ GET EVENT PARTICIPANTS
// ==================================================
export const getEventParticipants = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await eventModel.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (event.createdBy.toString() !== req.user.id && req.user.role === "student") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const participants = await eventRegistrationModel
      .find({
        event: eventId,
      })
      .populate("user", "name username email image role")
      .sort({
        createdAt: -1,
      });

    return res.json({
      success: true,
      participants,
    });
  } catch (error) {
    console.error("GET PARTICIPANTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================================================
// 6️⃣ EVENT ANALYTICS
// ==================================================
export const getEventAnalytics = async (req, res) => {
  try {
    const { eventId } = req.params;

    const registrations = await eventRegistrationModel.find({
      event: eventId,
    });

    const totalRegistered = registrations.length;

    const totalAttended = registrations.filter((r) => r.status === "attended").length;

    const attendanceRate =
      totalRegistered > 0 ? ((totalAttended / totalRegistered) * 100).toFixed(2) : 0;

    const departmentStats = {};

    registrations.forEach((r) => {
      departmentStats[r.department] = (departmentStats[r.department] || 0) + 1;
    });

    return res.json({
      success: true,
      analytics: {
        totalRegistered,
        totalAttended,
        attendanceRate,
        departmentStats,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================================================
// 7️⃣ EXPORT PARTICIPANTS CSV
// ==================================================
export const exportParticipantsCSV = async (req, res) => {
  try {
    const { eventId } = req.params;

    const participants = await eventRegistrationModel
      .find({
        event: eventId,
      })
      .populate("user", "name username email");

    // 🔥 NEW: Added CollegeName, Degree, and Year to the CSV export
    const csvData = participants.map((p) => ({
      Name: p.user?.name || p.user?.username,
      Email: p.email || p.user?.email, 
      College: p.collegeName || "N/A",
      Degree: p.degree || "N/A",
      Year: p.yearOfStudy || "N/A",
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
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};