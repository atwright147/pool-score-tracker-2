import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';

export const getSession = createServerFn({ method: 'GET' }).handler(
	async () => {
		const { auth } = await import('~/lib/auth');
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });
		return session;
	},
);

export async function requireAuth(pathname: string) {
	const session = await getSession();

	if (!session) {
		throw redirect({
			to: '/auth',
			search: {
				redirect: pathname,
			},
		});
	}

	return { session };
}
