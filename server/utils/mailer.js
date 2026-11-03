import nodemailer from 'nodemailer'

// Sends an e-mail through the SMTP server in .env.
// If SMTP is not configured (or sending fails) it does NOT throw: it returns
// { sent:false, error } and the app shows the invite link to copy instead.
export const smtpConfigured = () => Boolean(process.env.SMTP_HOST)

export async function sendMail({ to, subject, text, html }) {
    if (!smtpConfigured()) return { sent: false, error: "E-mail is not configured on the server" }
    try {
        const transport = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        })
        await transport.sendMail({
            from: process.env.SMTP_FROM || "SplitEasy <no-reply@spliteasy.local>",
            to, subject, text, html,
        })
        return { sent: true }
    } catch (error) {
        console.error("E-mail failed:", error.message)
        return { sent: false, error: "The e-mail could not be sent" }
    }
}
