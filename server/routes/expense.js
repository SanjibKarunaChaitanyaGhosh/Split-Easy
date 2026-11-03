import express from 'express'
import { list, getOne, history, send, update, remove, confirm, dispute } from '../controllers/expense.js'
import { uploadBill } from '../middleware/upload.js'
import { notLocked } from '../middleware/tripAccess.js'

// mounted at /api/trips/:id/expenses (auth + tripAccess already ran)
const expenseRoutes = express.Router({ mergeParams: true })

expenseRoutes.get("/", list)
// notLocked runs BEFORE the upload so a rejected request never leaves a file behind
expenseRoutes.post("/", notLocked, uploadBill, send)
expenseRoutes.get("/:eid", getOne)
expenseRoutes.put("/:eid", notLocked, uploadBill, update)
expenseRoutes.delete("/:eid", notLocked, remove)
expenseRoutes.get("/:eid/history", history)
expenseRoutes.post("/:eid/confirm", confirm)
expenseRoutes.post("/:eid/dispute", dispute)

export default expenseRoutes
