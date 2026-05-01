import mongoose from "mongoose";


const pendingRegistrationSchema =
  new mongoose.Schema(
    {

      email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        index: true,
      },


      name: {
        type: String,
        required: true,
        trim: true,
      },


      username: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        minlength: 3,
        maxlength: 20,
        index: true,
      },


      password: {
        type: String,
        required: true,
      },


      dob: {
        type: Date,
        required: true,
      },


      otp: {
        type: String,
        required: true,
      },


      otpExpires: {
        type: Date,
        required: true,
      },
    },
    {
      timestamps: true,
    }
  );


pendingRegistrationSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 900,
  }
);


pendingRegistrationSchema.index({
  username: 1,
});

const PendingRegistration =
  mongoose.models.PendingRegistration ||
  mongoose.model(
    "PendingRegistration",
    pendingRegistrationSchema
  );

export default PendingRegistration;