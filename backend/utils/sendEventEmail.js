import axios from "axios";
import "dotenv/config";

export const sendEventRegistrationEmail = async ({
  email,
  name,
  eventName,
  eventDate,
  location,
  qrCodeDataUrl, // Expected to be a Cloudinary URL
}) => {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) throw new Error("BREVO_API_KEY missing");

    // Parse dates for the calendar link
    const startDate = new Date(eventDate);
    // Assuming a standard 2-hour event duration if an end time isn't explicitly provided
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

    // Format date for the email body display
    const formattedDate = startDate.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Format date for Google Calendar (YYYYMMDDTHHMMSSZ)
    const formatGoogleDate = (date) =>
      date.toISOString().replace(/[-:]|\.\d{3}/g, "");

   
    const googleCalendarLink = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventName || "Campus Event")}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${encodeURIComponent("Event booked via UniEven. Please have your QR pass ready at the venue.")}&location=${encodeURIComponent(location || "TBA")}`;

   
    const htmlContent = `
    <div style="background-color:#f4f6fb; padding:30px 15px; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <div style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,0.05);">

        <!-- HEADER -->
        <div style="background:linear-gradient(135deg, #0f172a, #1e3a8a); color:#ffffff; padding:30px 20px; text-align:center;">
          <h2 style="margin:0; font-size: 24px; font-weight: 800; letter-spacing: 1px;">UniEven University</h2>
          <p style="margin:5px 0 15px 0; font-size: 14px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px;">Campus Events</p>
          <span style="background-color:#6366f1; color:#ffffff; padding:6px 14px; border-radius:20px; font-size: 12px; font-weight: bold; letter-spacing: 1px;">OFFICIAL DIGITAL PASS</span>
        </div>

        <!-- EVENT TITLE -->
        <div style="text-align:center; padding:30px 20px 10px 20px;">
          <h2 style="margin:0; color:#0f172a; font-size: 22px;">${eventName || "Upcoming Event"}</h2>
          <p style="color:#64748b; font-size: 14px; margin-top: 8px;">Innovate • Collaborate • Elevate</p>
        </div>

        <!-- QR CODE -->
        <div style="text-align:center; padding:10px 20px 20px 20px;">
          <div style="background-color:#f8fafc; display:inline-block; padding:15px; border-radius:16px; border: 1px solid #e2e8f0;">
            <img src="${qrCodeDataUrl}" alt="Your QR Pass" style="width:180px; height:180px; border-radius:10px; display:block; margin: 0 auto;" />
          </div>
          <p style="font-size:13px; color:#64748b; margin-top: 15px; font-weight: 500;">
            Scan this QR code at the entrance for quick check-in.
          </p>
        </div>

        <!-- EVENT DETAILS -->
        <div style="padding:0 30px 30px 30px;">
          <div style="background-color:#f8fafc; border-radius:12px; padding:20px; border: 1px solid #e2e8f0;">
            <p style="margin:0 0 10px 0; font-size: 15px; color:#334155;"><b>Attendee:</b> ${name || "Student"}</p>
            <p style="margin:0 0 10px 0; font-size: 15px; color:#334155;"><b>Email:</b> ${email}</p>
            <p style="margin:0 0 10px 0; font-size: 15px; color:#334155;"><b>Date & Time:</b> ${formattedDate}</p>
            <p style="margin:0; font-size: 15px; color:#334155;"><b>Venue:</b> ${location || "TBA"}</p>
          </div>
        </div>

        <!-- ADD TO CALENDAR BUTTON -->
        <div style="text-align:center; padding:0 20px 30px 20px;">
          <a href="${googleCalendarLink}" target="_blank" style="background-color:#2563eb; color:#ffffff; padding:14px 24px; border-radius:10px; text-decoration:none; font-weight:bold; font-size: 15px; display:inline-block; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">
            📅 Add to Google Calendar
          </a>
        </div>

        <!-- FOOTER -->
        <div style="background-color:#0f172a; color:#94a3b8; text-align:center; padding:20px; font-size: 13px;">
          🎟 Please have this email ready on your phone upon arrival.
        </div>

      </div>
    </div>
    `;

    // Execute API Call to Brevo
    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "UniEven",
          email: "unievenwebsite@gmail.com",
        },
        to: [{ email: email.toLowerCase().trim() }],
        subject: ` Your Ticket for ${eventName || "Campus Event"}`,
        htmlContent,
      },
      {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(" Digital Pass Email sent successfully to:", email);
    return { success: true };

  } catch (error) {
    console.error(" EMAIL DELIVERY ERROR:", error.response?.data || error.message);
    
    // Return gracefully so the calling function doesn't crash the server
    return {
      success: false,
      message: error.message,
    };
  }
};