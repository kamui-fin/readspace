import PostalMime from 'postal-mime';

// This defines what environment variables are passed to your script
export interface Env {
	BACKEND_URL: string;
	WEBHOOK_SECRET: string;
}

/** Extract the first HTTPS URL from a List-Unsubscribe or List-Archive header value.
 *  e.g. "<https://substack.com/unsub?t=...>, <mailto:...>" → "https://substack.com/unsub?t=..."
 */
function extractHttpsUrl(headerValue: string): string {
	const match = headerValue.match(/<(https?:\/\/[^>]+)>/i);
	return match ? match[1] : '';
}

export default {
	// We use the 'email' method instead of 'fetch' to intercept incoming mail traffic
	async email(message: any, env: Env, ctx: any): Promise<void> {
		// 1. Grab the "To" address (e.g., kamui.f83k9a@newsletters.readspace.com)
		const toAddress = message.to;

		// 2. Safely parse out the custom routing token
		let token = '';
		try {
			const localPart = toAddress.split('@')[0]; // "username.token" or "first.last.token"
			const parts = localPart.split('.');
			token = parts[parts.length - 1];
			if (!token) throw new Error('Missing token');
		} catch (err) {
			// If the address format is broken, bounce the email right here
			return message.setReject('Invalid address format.');
		}

		// 3. Parse the raw incoming email stream using postal-mime
		const parsedEmail = await PostalMime.parse(message.raw);

		// 4. Extract List-Unsubscribe / List-Archive headers for smarter favicon resolution.
		//    Primary: List-Unsubscribe (most reliable — every ESP sets this)
		//    Secondary: List-Archive (links to the web version of the post)
		const headers: Array<{ key: string; value: string }> = (parsedEmail as any).headers ?? [];
		const listUnsubHeader = headers.find((h) => h.key.toLowerCase() === 'list-unsubscribe')?.value ?? '';
		const listArchiveHeader = headers.find((h) => h.key.toLowerCase() === 'list-archive')?.value ?? '';
		const listUrl = extractHttpsUrl(listUnsubHeader) || extractHttpsUrl(listArchiveHeader);

		// 5. Construct the clean JSON payload for your backend
		const payload = {
			token: token,
			from: message.from,
			subject: parsedEmail.subject || '(No Subject)',
			html: parsedEmail.html || parsedEmail.text || '',
			list_url: listUrl || null,
		};

		// 6. Fire a POST request straight to your FastAPI/Dokploy VPS backend
		const backendUrl = env.BACKEND_URL || 'https://api.readspace.ai';
		const backendResponse = await fetch(`${backendUrl}/api/intake/webhook`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Readspace-Secret': env.WEBHOOK_SECRET,
			},
			body: JSON.stringify(payload),
		});

		if (!backendResponse.ok) {
			// If your main server crashes or drops the connection, bounce the mail back to sender
			return message.setReject('Readspace intake server error.');
		}
	},

	// Add fetch handler for local HTTP testing/triggering E2E newsletter flow
	async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Send a POST request to trigger mock email.', { status: 405 });
		}

		try {
			const body: any = await request.json();
			const toAddress = body.to || 'user.token@newsletters.readspace.com';
			const fromAddress = body.from || 'newsletter@substack.com';
			const subject = body.subject || 'E2E Test Email';
			const html = body.html || '<h1>Test</h1>';
			const listUrl = body.list_unsubscribe || '';

			// Build a raw MIME string that includes List-Unsubscribe if provided
			const listUnsubLine = listUrl ? `List-Unsubscribe: <${listUrl}>\n` : '';
			const mockMessage = {
				to: toAddress,
				from: fromAddress,
				raw: body.raw || `From: ${fromAddress}\nTo: ${toAddress}\nSubject: ${subject}\n${listUnsubLine}Content-Type: text/html\n\n${html}`,
				rejected: null as string | null,
				setReject(reason: string) {
					this.rejected = reason;
				},
			};

			// Delegate to the email handler
			await this.email(mockMessage, env, ctx);

			if (mockMessage.rejected) {
				return new Response(JSON.stringify({ status: 'rejected', reason: mockMessage.rejected }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			return new Response(JSON.stringify({ status: 'success' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (err: any) {
			return new Response(JSON.stringify({ error: err.message }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},
};
