import cron from "node-cron";
import eventRegistrationModel from "../models/EventRegistration.js";
import eventModel from "../models/Event.js";
import { sendEventRegistrationEmail } from "../utils/sendEventEmail.js";

// Runs every day at 9 AM
cron.schedule("0 9 * * *", async () => {
  console.log("⏰ Running reminder job...");

  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);

  const start = new Date(tomorrow.setHours(0, 0, 0, 0));
  const end = new Date(tomorrow.setHours(23, 59, 59, 999));

  try {
    const registrations = await eventRegistrationModel.find()
      .populate("event")
      .populate("user");

    for (const reg of registrations) {
      const eventDate = new Date(reg.event.date);

      if (eventDate >= start && eventDate <= end) {
        await sendReminderEmail(
          reg.email,
          reg.user?.name || "Student",
          reg.event.title,
          reg.event.date,
          reg.event.location
        );
      }
    }

    console.log("✅ Reminder emails sent");
  } catch (error) {
    console.error("❌ Reminder job error:", error);
  }
});