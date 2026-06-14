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
			const localPart = toAddress.split("@")[0]; // "kamui.f83k9a"
			token = localPart.split(".")[1];          // "f83k9a"
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
		const backendResponse = await fetch(`${backendUrl}/api/v1/intake/webhook`, {
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
	}
};
