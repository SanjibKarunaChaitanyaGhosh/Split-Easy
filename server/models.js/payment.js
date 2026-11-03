import mongoose from "mongoose";

// a settlement that has really happened ("Ravi paid Asha Rs.500")
const paymentSchema = new mongoose.Schema(
    {
        trip:{ type:mongoose.Schema.Types.ObjectId, ref:"trip", required:true },
        from:{ type:mongoose.Schema.Types.ObjectId, required:true },
        to:{ type:mongoose.Schema.Types.ObjectId, required:true },
        amount:{ type:Number, required:true, min:0.01 },
        date:{ type:Date, default:Date.now },
        note:{ type:String, trim:true, maxLength:200, default:"" },
        recordedBy:{ type:mongoose.Schema.Types.ObjectId, ref:"user", required:true },
        recordedByName:{ type:String, default:"" }
    },
    { timestamps:true }
)

paymentSchema.index({ trip:1, date:-1 })

const Payment = mongoose.model("payment",paymentSchema)

export default Payment
