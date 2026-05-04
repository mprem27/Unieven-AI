import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// CONFIGS
import connectDB from "./configs/mongodb.js";
import "./configs/cloudinary.js"; 

// ROUTES
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import reelRoutes from "./routes/reelRoutes.js";
import storyRoutes from "./routes/storyRoutes.js";
import followRoutes from "./routes/followRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import eventRegistrationRoutes from "./routes/eventRegistrationRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";

// CRON JOBS
import "./jobs/reminderJob.js";

// MIDDLEWARES
import errorMiddleware from "./middlewares/errorMiddleware.js";
import { apiLimiter } from "./middlewares/rateLimiter.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// =====================================================
//  CONNECT DATABASE
// =====================================================
connectDB();

// =====================================================
//  CORS CONFIG (FIXED)
// =====================================================
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (origin.includes("localhost")) {
        return callback(null, true);
      }

      if (
        origin.endsWith(".vercel.app") ||
        origin.endsWith(".onrender.com")
      ) {
        return callback(null, true);
      }

      console.log(" CORS Blocked:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

//  REMOVE OLD LINE
// app.options("/", cors());

// =====================================================
//  BODY PARSER
// =====================================================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// =====================================================
//  DEBUG LOGGER
// =====================================================
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// =====================================================
//  RATE LIMIT
// =====================================================
app.use("/api", apiLimiter);

// =====================================================
//  ROUTES
// =====================================================
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/reels", reelRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/event-registration", eventRegistrationRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/search", searchRoutes);

// =====================================================
//  ROOT ROUTE
// =====================================================
app.get("/", (req, res) => {
  res.send(" UniEven API is running...");
});

// =====================================================
//  ERROR HANDLER
// =====================================================
app.use(errorMiddleware);

// =====================================================
//  START SERVER
// =====================================================
app.listen(port, () => {
  console.log(` Server running on port ${port}`);
  console.log(` Reminder Cron Job initialized!`);
});