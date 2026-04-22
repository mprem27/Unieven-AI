import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// CONFIGS
import connectDB from "./configs/mongodb.js";
import connectCloudinary from "./configs/cloudinary.js"; 

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

// MIDDLEWARES
import errorMiddleware from "./middlewares/errorMiddleware.js";
import { apiLimiter } from "./middlewares/rateLimiter.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// CONNECT DB + CLOUDINARY
connectDB();
connectCloudinary();

// CORS (Production Ready)
const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL // set this in Render
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// BODY PARSER
app.use(express.json());

// RATE LIMIT
app.use("/api", apiLimiter);

// ROUTES
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

// ROOT
app.get("/", (req, res) => {
  res.send("UniEven API is running...");
});

// ERROR HANDLER
app.use(errorMiddleware);

// START SERVER
app.listen(port, () => {
  console.log(` Server running on port ${port}`);
});