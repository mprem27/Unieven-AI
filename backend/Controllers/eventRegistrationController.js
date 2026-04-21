import eventRegistrationModel from "../models/EventRegistration.js";
import eventModel from "../models/Event.js";
import notificationModel from "../models/Notification.js";


// --------------------------------------------------
// 1️⃣ REGISTER / UNREGISTER EVENT
// --------------------------------------------------
export const registerEvent = async (req, res) => {
  try {
    const { eventId, studentId, department, phone } = req.body;
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

    // ❌ Block past events
    if (new Date(event.date) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Event already completed",
      });
    }

    // 🔍 Check existing registration
    const existing = await eventRegistrationModel.findOne({
      user: userId,
      event: eventId,
    });

    // 🔁 UNREGISTER
    if (existing) {
      await eventRegistrationModel.findByIdAndDelete(existing._id);

      await eventModel.findByIdAndUpdate(eventId, {
        $pull: { attendees: userId },
      });

      return res.json({
        success: true,
        message: "Unregistered successfully",
      });
    }

    // ❗ VALIDATION (ONLY FOR NEW REGISTRATION)
    if (!studentId || !department || !phone) {
      return res.status(400).json({
        success: false,
        message: "All student details are required",
      });
    }

    // ✅ CREATE REGISTRATION
    const registration = await eventRegistrationModel.create({
      user: userId,
      event: eventId,
      studentId,
      department,
      phone,
      status: "registered",
    });

    // 👥 Add to attendees
    await eventModel.findByIdAndUpdate(eventId, {
      $addToSet: { attendees: userId },
    });

    // 🔔 Notification (safe check)
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

    // 🔥 Handle duplicate index error
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


// --------------------------------------------------
// 2️⃣ MARK ATTENDANCE
// --------------------------------------------------
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

    // ❌ Prevent duplicate marking
    if (registration.status === "attended") {
      return res.status(400).json({
        success: false,
        message: "Already marked",
      });
    }

    registration.status = "attended";
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


// --------------------------------------------------
// 3️⃣ GET USER EVENTS
// --------------------------------------------------
export const getUserEvents = async (req, res) => {
  try {
    const registrations = await eventRegistrationModel
      .find({ user: req.user.id })
      .populate({
        path: "event",
        select: "title date time location image createdBy",
      })
      .sort({ createdAt: -1 });

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


// --------------------------------------------------
// 4️⃣ GET EVENT PARTICIPANTS
// --------------------------------------------------
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

    // 🔐 Authorization
    if (
      event.createdBy.toString() !== req.user.id &&
      req.user.role === "student"
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const participants = await eventRegistrationModel
      .find({ event: eventId })
      .populate("user", "name username email image role")
      .sort({ createdAt: -1 });

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