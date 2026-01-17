// Server-only authentication utilities
// This file should only be imported in server contexts
import { auth } from '~/lib/auth';

export async function getSessionFromRequest(request: Request) {
	const session = await auth.api.getSession({
		headers: request.headers,
	});
	return session;
}
