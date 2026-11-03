import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema(
    {
        trip:{ type:mongoose.Schema.Types.ObjectId, ref:"trip", required:true },
        email:{ type:String, required:true, lowercase:true, trim:true },
        token:{ type:String, required:true, unique:true },
        status:{ type:String, enum:["pending","accepted","cancelled"], default:"pending" },
        invitedBy:{ type:mongoose.Schema.Types.ObjectId, ref:"user", required:true },
        invitedByName:{ type:String, default:"" },
        acceptedBy:{ type:mongoose.Schema.Types.ObjectId, ref:"user", default:null }
    },
    { timestamps:true }
)

invitationSchema.index({ trip:1, status:1 })
invitationSchema.index({ email:1, status:1 })

const Invitation = mongoose.model("invitation",invitationSchema)

export default Invitation
