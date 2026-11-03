import mongoose from "mongoose";
import crypto from "crypto";

// A participant is either a registered user (user is set) or a GUEST (name only, user is null).
// The participant _id (not the user id) is what expenses and payments point to.
const participantSchema = new mongoose.Schema(
    {
        name:{ type:String, required:true, trim:true, maxLength:60 },
        user:{ type:mongoose.Schema.Types.ObjectId, ref:"user", default:null },
        email:{ type:String, lowercase:true, trim:true, default:"" },
        role:{ type:String, enum:["admin","member"], default:"member" },
        lastReadChat:{ type:Date, default:Date.now }
    },
    { timestamps:{ createdAt:"joinedAt", updatedAt:false } }
)

const tripSchema = new mongoose.Schema(
    {
        name:{ type:String, required:true, trim:true, minLength:2, maxLength:80 },
        destination:{ type:String, trim:true, maxLength:100, default:"" },
        startDate:{ type:Date },
        endDate:{ type:Date },
        description:{ type:String, trim:true, maxLength:500, default:"" },
        emoji:{ type:String, trim:true, maxLength:8, default:"✈️" },
        admin:{ type:mongoose.Schema.Types.ObjectId, ref:"user", required:true },
        participants:[participantSchema],
        // invite link  /join/<inviteToken>
        inviteToken:{ type:String, unique:true, default:()=>crypto.randomBytes(16).toString("hex") },
        inviteEnabled:{ type:Boolean, default:true },
        // can ordinary members invite people by e-mail? (configurable by the admin)
        membersCanInvite:{ type:Boolean, default:false },
        // locked = final settlement: no new expenses or edits
        locked:{ type:Boolean, default:false }
    },
    { timestamps:true }
)

tripSchema.index({ "participants.user":1 })

const Trip = mongoose.model("trip",tripSchema)

export default Trip
