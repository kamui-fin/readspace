import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
    try {
        const { name, email, message, source } = await req.json()

        if (!name || !email || !message || !source) {
            return Response.json(
                { error: "All fields are required." },
                { status: 400 }
            )
        }

        const response = await resend.emails.send({
            from: "send@readspace.ai", // resend
            to: "support@readspace.ai", // google
            subject: "New Contact Form Submission",
            html: `<p><strong>Name:</strong> ${name}</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Source:</strong> ${source}</p>
             <p><strong>Message:</strong> ${message}</p>`,
        })

        return Response.json({ success: true, response }, { status: 200 })
    } catch (error) {
        if (error instanceof Error) {
            return Response.json({ error: error.message }, { status: 500 })
        } else {
            return Response.json(
                { error: "An unknown error occurred" },
                { status: 500 }
            )
        }
    }
}
