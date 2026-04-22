import eventModel from "../models/Event.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// --- 1. CREATE EVENT ---
export const createEvent = async (req, res) => {
  try {
    const { title, description, date, time, location, category } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: "Event poster is required" });
    }

    let upload;
    try {
      upload = await cloudinary.uploader.upload(file.path, {
        folder: "unieven_events",
        resource_type: "image",
      });
    } catch (err) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(500).json({ success: false, message: "Image upload failed" });
    }

    // Delete local temp file
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

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
    });

    res.status(201).json({ success: true, message: "Event created", event: newEvent });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 2. GET ALL EVENTS (With Auto-Complete Logic) ---
export const getAllEvents = async (req, res) => {
  try {
    const currentDate = new Date();

    // 🔥 1. AUTO-COMPLETE LOGIC: Mark past events as completed
    await eventModel.updateMany(
      { date: { $lt: currentDate }, status: "upcoming" },
      { $set: { status: "completed" } }
    );

    // Fetch updated events
    const events = await eventModel
      .find({})
      .populate("createdBy", "username image role")
      .sort({ date: 1 }); // Sort by closest date first

    res.json({ success: true, events });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 3. GET SINGLE EVENT (With Smart Recommendations) ---
export const getSingleEvent = async (req, res) => {
  try {
    const event = await eventModel
      .findById(req.params.id)
      .populate("createdBy", "username image role")
      .populate("attendees", "username image");

    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    // 🔥 2. SMART RECOMMENDATIONS LOGIC
    // Find up to 3 upcoming events in the SAME category, excluding this current event
    const recommendedEvents = await eventModel.find({
      category: event.category,
      _id: { $ne: event._id },
      status: "upcoming"
    })
    .populate("createdBy", "username image")
    .limit(3)
    .sort({ date: 1 });

    res.json({ 
      success: true, 
      event,
      recommendedEvents // Frontend can use this to show "More events like this"
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 4. JOIN / LEAVE EVENT ---
export const updateEventStatus = async (req, res) => {
  try {
    const event = await eventModel.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    if (event.status !== "upcoming") {
      return res.status(400).json({ success: false, message: "You can only join upcoming events" });
    }

    // Check if user is already attending
    const isAttending = event.attendees.includes(req.user.id);

    await event.updateOne({
      [isAttending ? "$pull" : "$push"]: { attendees: req.user.id },
    });

    res.json({
      success: true,
      message: isAttending ? "You left the event" : "You joined the event!",
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 5. DELETE EVENT ---
export const deleteEvent = async (req, res) => {
  try {
    const event = await eventModel.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    // Check if user owns the event (or is an admin based on your router logic)
    if (event.createdBy.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this event" });
    }

    // 🔥 DELETE IMAGE FROM CLOUDINARY
    if (event.image) {
      try {
        const publicId = event.image.split("/").pop().split(".")[0];
        // Note: Make sure to include the folder name if you uploaded it to a specific folder!
        await cloudinary.uploader.destroy(`unieven_events/${publicId}`);
      } catch (err) {
        console.log("Cloudinary delete error:", err.message);
      }
    }

    await eventModel.findByIdAndDelete(event._id);

    res.json({ success: true, message: "Event deleted successfully" });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};