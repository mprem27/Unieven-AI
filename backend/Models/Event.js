import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", 
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    time: {
      type: String, 
      required: true,
    },

    location: {
      type: String,
      required: true,
    },

    attendees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", 
      },
    ],

    category: {
      type: String,
      default: "General",
    },

    status: {
      type: String,
      enum: ["upcoming", "completed", "cancelled"],
      default: "upcoming",
    },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

eventSchema.index({ date: 1 });

const eventModel =
  mongoose.models.Event || mongoose.model("Event", eventSchema);

export default eventModel;