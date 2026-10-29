import mongoose from "mongoose";

export function isSocialLinkUrl(value) {
  if(typeof value!=='string'||value.length>2048||!/^https?:\/\//i.test(value)||/[\u0000-\u0020\u007f]/.test(value))return false;
  try {const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!!url.hostname&&!url.username&&!url.password;}catch{return false;}
}
const socialLinkSchema=new mongoose.Schema({
  label:{type:String,required:true,trim:true,maxlength:40},
  url:{type:String,required:true,trim:true,maxlength:2048,validate:{validator:isSocialLinkUrl,message:'Use an HTTP or HTTPS link without credentials'}},
},{_id:false});

const userSchema = new mongoose.Schema(
  {
    // =====================================================
    // 👤 BASIC USER INFO
    // =====================================================
    username: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      default: "",
      trim: true,
    },

    bio: {
      type: String,
      default: "",
      maxlength: 300,
    },
    // Self-described social details never change authorization or AMS records.
    socialDepartment: {type:String,default:'',trim:true,maxlength:100},
    socialLinks: {type:[socialLinkSchema],default:[],validate:{validator:links=>links.length<=5,message:'Add up to five social links'}},
    savedCampusEvents: [{type: mongoose.Schema.Types.ObjectId,ref:'Event'}],

    image: {
      type: String,
      default: "",
    },

    gender: {
      type: String,
      default: "Prefer not to say",
    },

    dob: {
      type: Date,
      default: null,
    },

    role: {
      type: String,
      enum: ["student", "faculty", "admin"],
      default: "student",
    },
    adminPermissions: {type:[String],default:undefined},
    adminActionPermissions: {type:mongoose.Schema.Types.Mixed,default:undefined},
    adminAccessRole: {type:String,enum:['custom','event_admin','exam_admin','moderator','news_editor','student_support','access_manager'],default:'custom'},
    adminCreatedBy: {type:mongoose.Schema.Types.ObjectId,ref:'User'},
    hasEventAssignment:{type:Boolean,default:false},

    // =====================================================
    // 🔐 OTP SYSTEM (Shared with Spring Boot)
    // =====================================================
    registerOTP: {
      type: String,
      default: null,
    },

    // Spring Boot writes "VERIFIED" or a 6-digit code here
    resetOTP: {
      type: String,
      default: null,
    },

    // Java Date and MongoDB Date are compatible
    otpExpires: {
      type: Date,
      default: null,
    },

    // =====================================================
    // ⚙️ ACCOUNT SETTINGS
    // =====================================================
    isPrivate: {
      type: Boolean,
      default: false,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    // =====================================================
    // 👥 SOCIAL CONNECTIONS
    // =====================================================
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    followRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // =====================================================
    // 📌 SAVED CONTENT
    // =====================================================
    savedPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
      },
    ],

    savedReels: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Reel",
      },
    ],

    // =====================================================
    // 🎓 CAMPUS DETAILS
    // =====================================================
    isActive: {type:Boolean,default:true},
    portalPrincipal: {type:String,unique:true,sparse:true},
    portalAcademicId: {type:String,unique:true,sparse:true},
    portalPrincipalVerifiedAt: Date,
    // Set only after a verified AMS login or verified application recovery.
    portalPasswordSetAt: Date,
    portalOnly: {type:Boolean,default:false},
    // Account recovery is independently verified; AMS/source email remains immutable.
    recoveryEmail: {type:String,default:'',trim:true,lowercase:true},
    recoveryEmailVerifiedAt: {type:Date,default:null},
    studentId: { type: String, default: "", trim: true },
    department: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    campusRole: { type: String, enum: ['student','club_organizer','department_coordinator','college_event_manager','placement_officer','admin'], default: 'student' },
    club: { type: String, default: '', trim: true },
  },
  {
    timestamps: true,
  }
);

userSchema.index({recoveryEmail:1},{unique:true,partialFilterExpression:{recoveryEmailVerifiedAt:{$type:'date'}}});

// Prevent sensitive data from being sent to the frontend by default
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.resetOTP;
    delete ret.registerOTP;
    return ret;
  },
});

const userModel = mongoose.models.User || mongoose.model("User", userSchema);

export default userModel;
