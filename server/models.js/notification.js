import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        user:{ type:mongoose.Schema.Types.ObjectId, ref:"user", required:true },
        trip:{ type:mongoose.Schema.Types.ObjectId, ref:"trip" },
        type:{ type:String, required:true },
        message:{ type:String, required:true },
        link:{ type:String, default:"" },
        read:{ type:Boolean, default:false }
    },
    { timestamps:true }
)

notificationSchema.index({ user:1, createdAt:-1 })

const Notification = mongoose.model("notification",notificationSchema)

export default Notification
