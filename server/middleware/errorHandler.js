// 404 for unknown routes
export const notFound = (req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` })
}

// ONE place that turns every error into a clean JSON response.
// (express-async-errors makes thrown errors inside async controllers land here.)
export const errorHandler = (err, req, res, next) => {
    let status = err.status || 500
    let message = err.message

    if (err.name === "ValidationError") {
        status = 400
        message = Object.values(err.errors).map((e) => e.message).join(", ")
    } else if (err.name === "CastError") {
        status = 400
        message = `Invalid ${err.path}`
    } else if (err.code === 11000) {
        status = 409
        message = `Duplicate value for ${Object.keys(err.keyValue || {}).join(", ")}`
    } else if (err.name === "MulterError") {
        status = 400
        message = err.code === "LIMIT_FILE_SIZE" ? "Bill photo must be 2 MB or smaller" : err.message
    } else if (err.type === "entity.too.large") {
        status = 413
        message = "Request is too large"
    } else if (err.type === "entity.parse.failed") {
        status = 400
        message = "Request body is not valid JSON"
    }

    if (status >= 500) {
        console.error(err)
        message = "Something went wrong on the server"
    }

    res.status(status).json({ error: message })
}
