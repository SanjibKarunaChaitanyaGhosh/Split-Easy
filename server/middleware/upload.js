import multer from 'multer'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { HttpError } from '../utils/httpError.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const uploadsDir = path.join(__dirname, '..', 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

const allowed = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    // random file name, extension taken from the checked mime type (never from the user)
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + allowed[file.mimetype]),
})

// bill photo: images only, max 2 MB, field name "billImage"
export const uploadBill = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (!allowed[file.mimetype]) return cb(new HttpError(400, 'Bill photo must be a JPG, PNG, WEBP or GIF image'))
        cb(null, true)
    },
}).single('billImage')

// deletes an uploaded file (ignores errors, e.g. when the file is already gone)
export const removeUpload = (publicPath) => {
    if (!publicPath || !publicPath.startsWith('/uploads/')) return
    fs.unlink(path.join(uploadsDir, path.basename(publicPath)), () => {})
}
