import mongoose from "mongoose";

export const CATEGORIES = ["Food","Stay","Transport","Fuel","Tickets","Shopping","Other"]

// one entry per person who must confirm the expense
const confirmationSchema = new mongoose.Schema(
    {
        participant:{ type:mongoose.Schema.Types.ObjectId, required:true },
        status:{ type:String, enum:["pending","confirmed","disputed"], default:"pending" },
        reason:{ type:String, default:"" },
        actedBy:{ type:mongoose.Schema.Types.ObjectId, ref:"user", default:null },
        at:{ type:Date }
    },
    { _id:false }
)

// version history: who changed what, and why
const versionSchema = new mongoose.Schema(
    {
        by:{ type:mongoose.Schema.Types.ObjectId, ref:"user" },
        byName:{ type:String },
        at:{ type:Date, default:Date.now },
        reason:{ type:String, default:"" },
        changes:[{ field:String, from:mongoose.Schema.Types.Mixed, to:mongoose.Schema.Types.Mixed, _id:false }]
    },
    { _id:false }
)

const expenseSchema = new mongoose.Schema(
    {
        trip:{ type:mongoose.Schema.Types.ObjectId, ref:"trip", required:true },
        createdBy:{ type:mongoose.Schema.Types.ObjectId, ref:"user", required:true },
        createdByName:{ type:String, default:"" },
        // participant _id of whoever actually paid
        paidBy:{ type:mongoose.Schema.Types.ObjectId, required:true },
        title:{ type:String, required:true, trim:true, maxLength:120 },
        amount:{ type:Number, required:true, min:0.01 },
        category:{ type:String, enum:CATEGORIES, default:"Other" },
        date:{ type:Date, default:Date.now },
        notes:{ type:String, trim:true, maxLength:500, default:"" },
        place:{ type:String, trim:true, maxLength:120, default:"" },
        location:{ lat:Number, lng:Number },
        billImage:{ type:String, default:"" },
        // "tagged" = only splitAmong share it, "whole" = every participant shares it
        splitMode:{ type:String, enum:["tagged","whole"], default:"tagged" },
        splitAmong:[{ type:mongoose.Schema.Types.ObjectId }],
        confirmations:[confirmationSchema],
        status:{ type:String, enum:["pending","confirmed","disputed"], default:"pending" },
        versions:[versionSchema]
    },
    { timestamps:true }
)

expenseSchema.index({ trip:1, date:-1 })

const Expense = mongoose.model("expense",expenseSchema)

export default Expense
