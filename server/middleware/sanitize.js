import { HttpError } from '../utils/httpError.js'

// Stops NoSQL operator injection: a body or query like {"email":{"$gt":""}} is rejected.
const hasOperator = (value) => {
    if (!value || typeof value !== "object") return false
    return Object.keys(value).some((k) => k.startsWith("$") || k.includes(".") || hasOperator(value[k]))
}

const sanitize = (req, res, next) => {
    if (hasOperator(req.body) || hasOperator(req.query)) {
        throw new HttpError(400, "Invalid characters in request")
    }
    next()
}

export default sanitize
