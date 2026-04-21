import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const mongo_uri = process.env.MONGODB_URI;

    if (!mongo_uri) {
      throw new Error("MONGODB_URI is not defined in .env file");
    }
    await mongoose.connect(mongo_uri);

    console.log(" MongoDB connected successfully!");
  } catch (err) {
    console.error(" MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

export default connectDB;