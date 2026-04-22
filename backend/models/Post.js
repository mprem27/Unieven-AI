import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        media: {
            type: String,
            required: true,
        },

        type: {
            type: String,
            enum: ["image", "video"],
            default: "image",
        },

        caption: {
            type: String,
            default: "",
        },

        likes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        
        comments: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Comment",
            },
        ],

        isEvent: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// 🔥 index for feed performance
postSchema.index({ createdAt: -1 });

// prevent overwrite
const postModel =
    mongoose.models.Post || mongoose.model("Post", postSchema);

export default postModel;