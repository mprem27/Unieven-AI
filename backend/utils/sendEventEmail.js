import axios from "axios";
import "dotenv/config";

/**
 * Sends event confirmation email with:
 * ✅ QR ticket
 * ✅ Google Calendar link
 */
export const sendEventRegistrationEmail = async ({
  email,
  name,
  eventName,
  eventDate,
  location,
  qrCodeDataUrl,
}) => {
  try {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      throw new Error("BREVO_API_KEY missing");
    }

    // =====================================================
    // 📅 DATE FORMATTING
    // =====================================================
    const startDate = new Date(eventDate);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // +2 hours

    const formattedDate = startDate.toLocaleString();

    const formatGoogleDate = (date) =>
      date.toISOString().replace(/[-:]|\.\d{3}/g, "");

    // =====================================================
    // 📅 GOOGLE CALENDAR LINK
    // =====================================================
    const googleCalendarLink = `https://www.google.com/calendar/render?action=TEMPLATE
&text=${encodeURIComponent(eventName)}
&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}
&details=${encodeURIComponent("Event booked via UniEven")}
&location=${encodeURIComponent(location || "TBA")}`;

    // =====================================================
    // 📧 EMAIL TEMPLATE
    // =====================================================
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px; border:1px solid #eee; border-radius:12px;">
        
        <h2 style="margin-top:0;">🎉 Registration Confirmed</h2>

        <p>Hi <b>${name}</b>,</p>
        <p>You’ve successfully registered for:</p>

        <h3 style="margin:10px 0;">${eventName}</h3>

        <p><b>Date:</b> ${formattedDate}</p>
        <p><b>Location:</b> ${location || "TBA"}</p>

        <!-- 📅 Google Calendar Button -->
        <div style="text-align:center; margin:20px 0;">
          <a href="${googleCalendarLink}" target="_blank"
            style="background:#2563eb; color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none;">
            📅 Add to Google Calendar
          </a>
        </div>

        <hr style="margin:20px 0;" />

        <p><b>Your Entry QR Ticket:</b></p>

        <div style="text-align:center; margin:16px 0;">
          <img src="${qrCodeDataUrl}" alt="QR Ticket" style="width:200px; height:200px;" />
        </div>

        <p style="font-size:13px; color:#555;">
          Show this QR code at the venue for entry/attendance.
        </p>

        <hr style="margin:20px 0;" />

        <p>See you there!<br/><b>— UniEven Team</b></p>
      </div>
    `;

    // =====================================================
    // 📤 SEND EMAIL VIA BREVO
    // =====================================================
    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "UniEven",
          email: "unievenwebsite@gmail.com",
        },
        to: [{ email: email.toLowerCase().trim() }],
        subject: `🎟️ Your Ticket for ${eventName}`,
        htmlContent,
      },
      {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    console.log("✅ Email sent to:", email);

    return { success: true };
  } catch (error) {
    console.error(
      "❌ EMAIL ERROR:",
      error.response?.data || error.message
    );

    return {
      success: false,
      message: error.response?.data?.message || error.message,
    };
  }
};