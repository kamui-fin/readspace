import PostalMime from 'postal-mime';

// This defines what environment variables are passed to your script
export interface Env {
	BACKEND_URL: string;
	WEBHOOK_SECRET: string;
}

export default {
	// We use the 'email' method instead of 'fetch' to intercept incoming mail traffic
	async email(message: any, env: Env, ctx: any): Promise<void> {

		// 1. Grab the "To" address (e.g., kamui.f83k9a@news.readspace.com)
		const toAddress = message.to;

		// 2. Safely parse out the custom routing token
		let token = "";
		try {
			const localPart = toAddress.split("@")[0]; // "username.token" or "first.last.token"
			const parts = localPart.split(".");
			token = parts[parts.length - 1];
			if (!token) throw new Error("Missing token");
		} catch (err) {
			// If the address format is broken, bounce the email right here
			return message.setReject("Invalid address format.");
		}

		// 3. Parse the raw incoming email stream using postal-mime
		const parsedEmail = await PostalMime.parse(message.raw);

		// 4. Construct the clean JSON payload for your backend
		const payload = {
			token: token,
			from: message.from,
			subject: parsedEmail.subject || "(No Subject)",
			html: parsedEmail.html || parsedEmail.text || ""
		};

		// 5. Fire a POST request straight to your FastAPI/Dokploy VPS backend
		const backendUrl = env.BACKEND_URL || "https://api.readspace.com";
		const backendResponse = await fetch(`${backendUrl}/api/intake/webhook`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Readspace-Secret": env.WEBHOOK_SECRET
			},
			body: JSON.stringify(payload)
		});

		if (!backendResponse.ok) {
			// If your main server crashes or drops the connection, bounce the mail back to sender
			return message.setReject("Readspace intake server error.");
		}
	},

	// Add fetch handler for local HTTP testing/triggering E2E newsletter flow
	async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
		if (request.method !== "POST") {
			return new Response("Send a POST request to trigger mock email.", { status: 405 });
		}

		try {
			const body: any = await request.json();
			const toAddress = body.to || "test.kamuitoken@newsletters.readspace.com";
			const fromAddress = body.from || "newsletter@substack.com";
			const subject = body.subject || "E2E Test Email";
			const html = body.html || "<h1>Test</h1>";

			const mockMessage = {
				to: toAddress,
				from: fromAddress,
				raw: body.raw || `From: ${fromAddress}\nTo: ${toAddress}\nSubject: ${subject}\nContent-Type: text/html\n\n${html}`,
				rejected: null as string | null,
				setReject(reason: string) {
					this.rejected = reason;
				}
			};

			// Delegate to the email handler
			await this.email(mockMessage, env, ctx);

			if (mockMessage.rejected) {
				return new Response(JSON.stringify({ status: "rejected", reason: mockMessage.rejected }), {
					status: 400,
					headers: { "Content-Type": "application/json" }
				});
			}

			return new Response(JSON.stringify({ status: "success" }), {
				status: 200,
				headers: { "Content-Type": "application/json" }
			});
		} catch (err: any) {
			return new Response(JSON.stringify({ error: err.message }), {
				status: 500,
				headers: { "Content-Type": "application/json" }
			});
		}
	}
};
