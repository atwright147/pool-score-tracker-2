import { Center, Paper, Stack, Text, Title } from '@mantine/core';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';

const getSession = createServerFn({ method: 'GET' }).handler(async () => {
	const { auth } = await import('~/lib/auth');
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });
	return session;
});

export const Route = createFileRoute('/protected')({
	beforeLoad: async () => {
		const session = await getSession();

		if (!session) {
			throw redirect({
				to: '/auth',
				search: {
					redirect: '/protected',
				},
			});
		}

		return { session };
	},
	component: ProtectedPage,
});

function ProtectedPage() {
	const { session } = Route.useRouteContext();

	return (
		<Center h="100vh">
			<Stack align="center">
				<Title order={1}>Protected Page</Title>
				<Paper shadow="md" p="xl" radius="md" withBorder>
					<Text size="lg">
						Welcome,{' '}
						<Text span fw={600}>
							{session.user.name}
						</Text>
						!
					</Text>
					<Text mt="md" c="dimmed">
						This page is only accessible to authenticated users.
					</Text>
					<Text mt="xs" size="sm" c="dimmed">
						Email: {session.user.email}
					</Text>
				</Paper>
			</Stack>
		</Center>
	);
}
