import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import User from '../models.js/user.js'
import { HttpError } from '../utils/httpError.js'
import { isEmail, text } from '../utils/validate.js'

// token expiry: 7 days (spec)
const makeToken = (user) => jwt.sign({ id: user._id }, process.env.Jwt_SECRET_KEY, { expiresIn: "7d" })
const shape = (user) => ({ id: user._id, name: user.name, email: user.email })

export const register = async (req, res) => {
    const name = text(req.body.name, { field: "Name", min: 2, max: 60, required: true })
    const email = text(req.body.email, { field: "Email", max: 120, required: true }).toLowerCase()
    const password = String(req.body.password || "")

    if (!isEmail(email)) throw new HttpError(400, "Please enter a valid email")
    if (password.length < 6) throw new HttpError(400, "Password must be at least 6 characters")
    if (password.length > 72) throw new HttpError(400, "Password must be at most 72 characters")

    if (await User.findOne({ email })) throw new HttpError(409, "An account with this email already exists")

    //Password hasing
    const hashPassword = await bcrypt.hash(password, 10)
    const user = await User.create({ name, email, password: hashPassword })

    res.status(201).json({ message: "Signup Successfully.....", token: makeToken(user), user: shape(user) })
}

export const login = async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase()
    const password = String(req.body.password || "")
    if (!email || !password) throw new HttpError(400, "Email and password are required")

    const user = await User.findOne({ email }).select("+password")

    // PHASE 2: an account made with Google has no password -> tell the user to use the Google button
    if (user && !user.password) throw new HttpError(400, "This account uses Google sign-in")

    // same message for "no such email" and "wrong password" so emails cannot be guessed
    if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new HttpError(401, "Email or password is not matched....")
    }

    res.status(200).json({ message: "Login successfully..........", token: makeToken(user), user: shape(user) })
}

export const me = async (req, res) => {
    res.status(200).json({ user: req.user })
}
