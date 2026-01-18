import { Center, Paper, Stack, Text, Title } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/profile')({
	component: ProfilePage,
});

function ProfilePage() {
	const { session } = Route.useRouteContext();

	return (
		<Center h="100vh">
			<Stack align="center">
				<Title order={1}>Profile Page</Title>
				<Paper shadow="md" p="xl" radius="md" withBorder>
					<Text size="lg">
						Welcome,{' '}
						<Text span fw={600}>
							{session.user.name}
						</Text>
						!
					</Text>
					<Text mt="md" c="dimmed">
						Email: {session.user.email}
					</Text>
				</Paper>
			</Stack>
		</Center>
	);
}
