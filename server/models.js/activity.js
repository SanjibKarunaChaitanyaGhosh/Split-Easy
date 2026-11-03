import mongoose from "mongoose";

// automatic timeline of everything that happens in a trip
const activitySchema = new mongoose.Schema(
    {
        trip:{ type:mongoose.Schema.Types.ObjectId, ref:"trip", required:true },
        actor:{ type:mongoose.Schema.Types.ObjectId, ref:"user" },
        actorName:{ type:String, default:"" },
        type:{ type:String, required:true },
        message:{ type:String, required:true },
        meta:{ type:mongoose.Schema.Types.Mixed }
    },
    { timestamps:true }
)

activitySchema.index({ trip:1, createdAt:-1 })

const Activity = mongoose.model("activity",activitySchema)

export default Activity
