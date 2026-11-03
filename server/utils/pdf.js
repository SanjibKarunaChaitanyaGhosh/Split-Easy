import PDFDocument from 'pdfkit'

// ---------------------------------------------------------------------------
// Builds the trip bill as a PDF and streams it into `res`.
// pdfkit's built-in fonts do not contain the rupee sign, so amounts are written as "Rs.".
// ---------------------------------------------------------------------------
const money = (n) => `Rs. ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fdate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-")

const INDIGO = "#4f46e5"
const GREY = "#6b7280"
const LINE = "#e5e7eb"

export function writeTripPdf(res, { trip, expenses, summary, payments, admin }) {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true, info: { Title: `${trip.name} - expense bill`, Author: "SplitEasy" } })
    doc.pipe(res)

    const left = 40
    const width = doc.page.width - 80
    const bottom = () => doc.page.height - 60 // leave room for the page number
    const nameOf = (id) => trip.participants.find((p) => String(p._id) === String(id))?.name || "(removed)"

    const ensureSpace = (h) => { if (doc.y + h > bottom()) doc.addPage() }

    const heading = (t) => {
        ensureSpace(50)
        doc.moveDown(0.8).font("Helvetica-Bold").fontSize(13).fillColor(INDIGO).text(t, left)
        doc.moveTo(left, doc.y + 2).lineTo(left + width, doc.y + 2).strokeColor(INDIGO).lineWidth(1).stroke()
        doc.moveDown(0.6).fillColor("black").font("Helvetica").fontSize(10)
    }

    // draws a table. cols: [{ title, width, align }], rows: arrays of strings. Header repeats on every page.
    const table = (cols, rows, opts = {}) => {
        const pad = 4
        const drawRow = (cells, isHeader, shade) => {
            doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(isHeader ? 8.5 : 8.5)
            const heights = cells.map((c, i) => doc.heightOfString(String(c), { width: cols[i].width - pad * 2 }))
            const h = Math.max(...heights) + pad * 2
            if (doc.y + h > bottom()) { doc.addPage(); drawRow(cols.map((c) => c.title), true); doc.font("Helvetica").fontSize(8.5) }
            const y = doc.y
            if (isHeader) doc.rect(left, y, width, h).fill(INDIGO)
            else if (shade) doc.rect(left, y, width, h).fill("#f9fafb")
            let x = left
            cells.forEach((c, i) => {
                doc.fillColor(isHeader ? "white" : "black").font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(8.5)
                   .text(String(c), x + pad, y + pad, { width: cols[i].width - pad * 2, align: cols[i].align || "left" })
                x += cols[i].width
            })
            doc.moveTo(left, y + h).lineTo(left + width, y + h).strokeColor(LINE).lineWidth(0.5).stroke()
            doc.y = y + h
            doc.x = left
        }
        drawRow(cols.map((c) => c.title), true)
        if (rows.length === 0) { doc.fillColor(GREY).text(opts.empty || "Nothing to show.", left + pad, doc.y + 6); doc.fillColor("black"); return }
        rows.forEach((r, i) => drawRow(r, false, i % 2 === 1))
    }

    // ---- title block ---------------------------------------------------------
    doc.rect(0, 0, doc.page.width, 90).fill(INDIGO)
    doc.fillColor("white").font("Helvetica-Bold").fontSize(22).text(trip.name, left, 28, { width })
    doc.font("Helvetica").fontSize(10).text("Expense bill  |  generated with SplitEasy", left, 58)
    doc.fillColor("black").y = 110

    doc.font("Helvetica").fontSize(10)
    const info = [
        ["Destination", trip.destination || "-"],
        ["Dates", trip.startDate || trip.endDate ? `${fdate(trip.startDate)}  to  ${fdate(trip.endDate)}` : "-"],
        ["Trip admin", admin],
        ["Participants", `${trip.participants.length}`],
        ["Status", trip.locked ? "Locked (final settlement)" : "Open"],
    ]
    info.forEach(([k, v]) => {
        doc.font("Helvetica-Bold").text(`${k}:`, left, doc.y, { continued: true, width }).font("Helvetica").text(`  ${v}`)
    })
    doc.moveDown(0.4)
    doc.font("Helvetica-Bold").text("People: ", left, doc.y, { continued: true, width }).font("Helvetica")
        .text(trip.participants.map((p) => `${p.name}${p.user ? "" : " (not registered)"}`).join(", "))

    // ---- itemised expenses -----------------------------------------------------
    heading("Itemised expenses")
    const cols = [
        { title: "Date", width: 50 }, { title: "Item", width: 85 }, { title: "Category", width: 50 },
        { title: "Place", width: 60 }, { title: "Paid by", width: 55 }, { title: "Split among", width: 100 },
        { title: "Amount", width: 60, align: "right" }, { title: "Status", width: 55 },
    ]
    const sorted = [...expenses].sort((a, b) => new Date(a.date) - new Date(b.date))
    table(cols, sorted.map((e) => [
        fdate(e.date), e.title, e.category, e.place || "-", nameOf(e.paidBy),
        e.splitMode === "whole" ? "Whole trip (everyone)" : e.splitAmong.map(nameOf).join(", "),
        money(e.amount), e.status.charAt(0).toUpperCase() + e.status.slice(1),
    ]), { empty: "No expenses recorded yet." })

    // ---- totals --------------------------------------------------------------------
    heading("Totals")
    ensureSpace(60)
    const all = expenses.reduce((s, e) => s + e.amount, 0)
    doc.font("Helvetica-Bold").text("Total spent (counted below): ", left, doc.y, { continued: true }).font("Helvetica").text(money(summary.totalSpent))
    doc.font("Helvetica-Bold").text("All recorded expenses (any status): ", left, doc.y, { continued: true }).font("Helvetica").text(money(all))
    doc.font("Helvetica-Bold").text("Equal share per person: ", left, doc.y, { continued: true }).font("Helvetica").text(money(summary.equalShare))
    doc.fillColor(GREY).fontSize(8.5).text(summary.includePending
        ? "Balances include expenses that are still pending confirmation. Disputed expenses are never counted."
        : "Balances count CONFIRMED expenses only. Pending and disputed expenses are not included.", left, doc.y + 4, { width })
    doc.fillColor("black").fontSize(10)

    // ---- each person's share and balance ---------------------------------------------
    heading("Each person's share and balance")
    table([
        { title: "Person", width: 135 }, { title: "Paid", width: 75, align: "right" }, { title: "Share", width: 75, align: "right" },
        { title: "Settled", width: 75, align: "right" }, { title: "Balance", width: 155, align: "right" },
    ], summary.rows.map((r) => [
        r.name, money(r.paid), money(r.share), money(r.sent - r.received),
        r.net > 0.005 ? `gets back ${money(r.net)}` : r.net < -0.005 ? `owes ${money(-r.net)}` : "all settled",
    ]))

    // ---- settle up ----------------------------------------------------------------------
    heading("How to settle up")
    if (summary.settlements.length === 0) {
        doc.text("Everyone is settled up. Nothing more to pay.", left)
    } else {
        doc.text("The fewest payments that settle everybody:", left).moveDown(0.3)
        summary.settlements.forEach((s, i) => {
            ensureSpace(18)
            doc.font("Helvetica-Bold").text(`${i + 1}.  ${s.fromName}`, left + 8, doc.y, { continued: true })
               .font("Helvetica").text("  pays  ", { continued: true })
               .font("Helvetica-Bold").text(`${s.toName}  ${money(s.amount)}`)
        })
        doc.font("Helvetica")
    }

    if (payments.length) {
        heading("Payments already made")
        table([
            { title: "Date", width: 70 }, { title: "From", width: 120 }, { title: "To", width: 120 },
            { title: "Amount", width: 85, align: "right" }, { title: "Note", width: 120 },
        ], payments.map((p) => [fdate(p.date), nameOf(p.from), nameOf(p.to), money(p.amount), p.note || "-"]))
    }

    // ---- footer on every page: generated date + page numbers --------------------------------
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i)
        doc.page.margins.bottom = 0 // otherwise writing near the bottom would add a blank page
        doc.font("Helvetica").fontSize(8).fillColor(GREY)
           .text(`Generated on ${new Date().toLocaleString("en-IN")}  |  SplitEasy`, left, doc.page.height - 35, { width: width - 80, lineBreak: false })
           .text(`Page ${i + 1} of ${range.count}`, left + width - 80, doc.page.height - 35, { width: 80, align: "right", lineBreak: false })
    }
    doc.end()
}
