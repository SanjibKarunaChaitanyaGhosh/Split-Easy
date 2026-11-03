import mongoose from 'mongoose'
import { HttpError } from './httpError.js'

export const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

// trims a string and checks its length. Returns '' for missing optional values.
export const text = (value, { field, min = 0, max = 200, required = false } = {}) => {
    const s = value === undefined || value === null ? '' : String(value).trim()
    if (required && s.length === 0) throw new HttpError(400, `${field} is required`)
    if (s.length > 0 && s.length < min) throw new HttpError(400, `${field} must be at least ${min} characters`)
    if (s.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`)
    return s
}

export const checkId = (id, label = 'id') => {
    if (!mongoose.isValidObjectId(id)) throw new HttpError(400, `Invalid ${label}`)
    return String(id)
}

// returns a Date, or undefined when the value is empty. Throws on an invalid date.
export const toDate = (value, field = 'date') => {
    if (value === undefined || value === null || value === '') return undefined
    const d = new Date(value)
    if (isNaN(d.getTime())) throw new HttpError(400, `${field} is not a valid date`)
    return d
}

// escapes HTML so chat text can never inject markup
export const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
