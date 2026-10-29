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
    eventFormat: {type:String,enum:['on-campus','online','hybrid'],default:'on-campus'},
    endTime: {type:String,default:''},
    meetingUrl: {type:String,default:'',maxlength:2000},
    agenda: {type:[new mongoose.Schema({time:{type:String,required:true},title:{type:String,required:true,maxlength:160},speaker:{type:String,default:'',maxlength:120}},{_id:false})],default:[]},
    contactName: {type:String,default:'',maxlength:120},
    contactPhone: {type:String,default:'',maxlength:40},
    accessibilityNotes: {type:String,default:'',maxlength:2000},
    attendanceInstructions: {type:String,default:'',maxlength:2000},

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
    scope: { type: String, enum: ['legacy','club','department','college'], default: 'legacy' },
    department: { type: String, default: '' },
    club: { type: String, default: '' },
    capacity: { type: Number, default: 500, min: 1 },
    registrationCount: { type: Number, default: 0, min: 0 },
    pricePaise: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR', enum: ['INR'] },
    organizerName: { type: String, default: '' },
    deadline: { type: Date, default: null },
    startsAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    expiresAt:{type:Date,default:null,index:true},posterFit:{type:String,enum:['cover','contain'],default:'cover'},posterTheme:{type:String,enum:['navy','teal','indigo'],default:'navy'},posterPosition:{type:Number,default:50,min:0,max:100},
    ticketHistory: { type: Boolean, default: false },
    video: { type: String, default: '' },
    rules: {type:[String],default:[]},registrationInstructions:{type:String,default:''},eligibility:{type:String,default:''},contactEmail:{type:String,default:''},
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
