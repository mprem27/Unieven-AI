import mongoose from "mongoose";

const followSchema = new mongoose.Schema(
  {

    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },


    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },


    status: {
      type: String,
      enum: ["requested", "accepted"],
      default: "requested", 
    },
  },
  { timestamps: true }
);


followSchema.index({ from: 1, to: 1 }, { unique: true });

const followModel =
  mongoose.models.Follow || mongoose.model("Follow", followSchema);

export default followModel;