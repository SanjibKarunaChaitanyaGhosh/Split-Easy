// an error that carries an HTTP status code. The central error handler turns it into JSON.
export class HttpError extends Error {
    constructor(status, message) {
        super(message)
        this.status = status
    }
}
