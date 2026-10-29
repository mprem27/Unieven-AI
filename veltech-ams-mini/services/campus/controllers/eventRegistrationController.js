import { canManageEvent } from "../campus/policy.js";
import { checkIn, registerForEvent as secureRegister, cancelRegistration } from "../campus/services/registration.js";
import User from "../models/User.js";
import eventRegistrationModel from "../models/EventRegistration.js";
import eventModel from "../models/Event.js";
import notificationModel from "../models/Notification.js";
import QRCode from "qrcode";
import crypto from "crypto";
import { Parser } from "json2csv";

// 🔥 CLOUDINARY IMPORT FOR QR IMAGE HOSTING
import cloudinary from "../configs/cloudinary.js";

// 🔥 EMAIL UTILITY IMPORT
import { sendEventRegistrationEmail } from "../utils/sendEventEmail.js";

// ==================================================
// 1️⃣ REGISTER / UNREGISTER EVENT + QR GENERATION
// ==================================================
export const registerEvent = async (req, res) => {
  try {
    const event = await eventModel.findById(req.body.eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    if (event.pricePaise > 0) return res.status(409).json({ success: false, message: "Use UniEve Campus to securely pay for this event" });
    const user = await User.findById(req.user.id);
    const existing = await eventRegistrationModel.findOne({user: req.user.id, event: event.id});
    if (existing && existing.status === "registered") {
      const registration = await cancelRegistration(user, existing.id);
      return res.json({ success: true, message: "Unregistered successfully", registration });
    }
    const registration = await secureRegister(user, event.id, {}, req.body);
    return res.status(201).json({ success: true, message: "Registered successfully", registration });
  } catch (error) { return res.status(error.status || 500).json({ success: false, message: error.message }); }
};

// ==================================================
// 2️⃣ MARK ATTENDANCE MANUALLY
// ==================================================
export const markAttendance = async (req, res) => {
  try {
    const registration = await checkIn(req.user, req.params.registrationId);
    return res.json({ success: true, message: "Attendance marked", registration });
  } catch (error) { return res.status(error.status || 500).json({ success: false, message: error.message }); }
};

// ==================================================
// 3️⃣ VERIFY QR ATTENDANCE
// ==================================================
export const verifyEventQR = async (req, res) => {
  try {
    const parsed = typeof req.body.qrData === "string" ? JSON.parse(req.body.qrData) : req.body.qrData;
    if (!parsed?.registrationId || !parsed?.qrToken) return res.status(400).json({success:false,message:"Invalid QR data"});
    const registration = await checkIn(req.user, parsed.registrationId, parsed.qrToken);
    return res.json({ success: true, message: "QR verified successfully", participant: registration });
  } catch (error) { return res.status(error instanceof SyntaxError ? 400 : error.status || 500).json({ success: false, message: error.message }); }
};

// ==================================================
// 4️⃣ GET USER EVENTS
// ==================================================
export const getUserEvents = async (req, res) => {
  try {
    const registrations = await eventRegistrationModel
      .find({ user: req.user.id })
      .populate({ path: "event", select: "title date time location image createdBy category" })
      .sort({ createdAt: -1 });

    return res.json({ success: true, registrations });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================================================
// 5️⃣ GET EVENT PARTICIPANTS
// ==================================================
export const getEventParticipants = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await eventModel.findById(eventId);

    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    if (!canManageEvent(req.user, event)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const participants = await eventRegistrationModel
      .find({ event: eventId })
      .populate("user", "name username email image role")
      .sort({ createdAt: -1 });

    return res.json({ success: true, participants });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================================================
// 6️⃣ EVENT ANALYTICS
// ==================================================
export const getEventAnalytics = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await eventModel.findById(eventId);
    if (!canManageEvent(req.user, event)) return res.status(403).json({success:false,message:"Organizer access required for this event"});
    const registrations = await eventRegistrationModel.find({ event: eventId });

    const totalRegistered = registrations.length;
    const totalAttended = registrations.filter((r) => r.status === "attended").length;
    const attendanceRate = totalRegistered > 0 ? ((totalAttended / totalRegistered) * 100).toFixed(2) : 0;
    const departmentStats = {};

    registrations.forEach((r) => {
      departmentStats[r.department] = (departmentStats[r.department] || 0) + 1;
    });

    return res.json({ success: true, analytics: { totalRegistered, totalAttended, attendanceRate, departmentStats } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================================================
// 7️⃣ EXPORT PARTICIPANTS CSV
// ==================================================
export const exportParticipantsCSV = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await eventModel.findById(eventId);
    if (!canManageEvent(req.user, event)) return res.status(403).json({success:false,message:"Organizer access required for this event"});
    const participants = await eventRegistrationModel
      .find({ event: eventId })
      .populate("user", "name username email");

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
    return res.status(500).json({ success: false, message: error.message });
  }
};