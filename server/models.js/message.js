import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        trip:{ type:mongoose.Schema.Types.ObjectId, ref:"trip", required:true },
        sender:{ type:mongoose.Schema.Types.ObjectId, ref:"user", required:true },
        senderName:{ type:String, required:true },
        text:{ type:String, required:true, maxLength:1000 },
        // set when an expense is shared in the chat (shown as a small card)
        expense:{
            id:{ type:mongoose.Schema.Types.ObjectId },
            title:String,
            amount:Number
        }
    },
    { timestamps:true }
)

messageSchema.index({ trip:1, createdAt:-1 })

const Message = mongoose.model("message",messageSchema)

export default Message
