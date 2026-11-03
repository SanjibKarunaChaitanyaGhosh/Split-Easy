import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name:{
            type:String,
            required:true,
            trim:true,
            minLength:2,
            maxLength:60
        },
        email:{
            type:String,
            required:true,
            unique:true,
            lowercase:true,
            trim:true
        },
        // PHASE 2 (Google login): password is optional so that a Google-only account can exist.
        // The login controller already refuses password login when there is no password.
        password:{
            type:String,
            select:false
        }
        // PHASE 2: add  googleId:{ type:String, unique:true, sparse:true }  here and verify the
        // Google ID token on the server with google-auth-library (see README).
    },
    {timestamps:true}
)

const User = mongoose.model("user",userSchema)

export default User
