import jwt from 'jsonwebtoken'
import User from '../models.js/user.js'
import { HttpError } from '../utils/httpError.js'

// reads "Authorization: Bearer <token>", checks it, and loads the user.
// Used by the REST routes AND by the socket.io handshake.
export const userFromToken = async (token) => {
    if (!token) throw new HttpError(401, "Please log in...")

    let payload
    try {
        payload = jwt.verify(token, process.env.Jwt_SECRET_KEY)
    } catch (error) {
        throw new HttpError(401, "Invalid or expired token...")
    }

    const user = await User.findById(payload.id).select("name email")
    if (!user) throw new HttpError(401, "Account no longer exists...")

    return { id: String(user._id), name: user.name, email: user.email }
}

const auth = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1]
    // Store verified user information inside the current request
    req.user = await userFromToken(token)
    next()
}

export default auth
