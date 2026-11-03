import mongoose from "mongoose";

const editRequestSchema = new mongoose.Schema(
    {
        trip:{ type:mongoose.Schema.Types.ObjectId, ref:"trip", required:true },
        // optional: the request can also be about something general / a missing item
        expense:{ type:mongoose.Schema.Types.ObjectId, ref:"expense", default:null },
        expenseTitle:{ type:String, default:"" },
        requestedBy:{ type:mongoose.Schema.Types.ObjectId, ref:"user", required:true },
        requestedByName:{ type:String, default:"" },
        reason:{ type:String, required:true, trim:true, maxLength:500 },
        correction:{ type:String, required:true, trim:true, maxLength:500 },
        status:{ type:String, enum:["open","resolved","rejected"], default:"open" },
        resolvedBy:{ type:mongoose.Schema.Types.ObjectId, ref:"user", default:null },
        resolvedByName:{ type:String, default:"" },
        resolvedNote:{ type:String, default:"" },
        resolvedAt:{ type:Date }
    },
    { timestamps:true }
)

editRequestSchema.index({ trip:1, createdAt:-1 })

const EditRequest = mongoose.model("editrequest",editRequestSchema)

export default EditRequest
