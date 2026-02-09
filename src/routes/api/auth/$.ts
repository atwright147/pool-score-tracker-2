import { createFileRoute } from '@tanstack/react-router';

import { auth } from '~/lib/auth';

export const Route = createFileRoute('/api/auth/$')({
	server: {
		handlers: {
			GET: async ({ request }) => {
				try {
					// better-auth expects a standard Web API Request object
					const response = await auth.handler(request);
					return response;
				} catch (error) {
					console.error('Auth GET error:', error);
					return new Response('Internal Server Error', { status: 500 });
				}
			},
			POST: async ({ request }) => {
				try {
					// better-auth expects a standard Web API Request object
					const response = await auth.handler(request);
					return response;
				} catch (error) {
					console.error('Auth POST error:', error);
					return new Response('Internal Server Error', { status: 500 });
				}
			},
		},
	},
});
