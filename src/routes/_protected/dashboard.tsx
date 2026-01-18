import { Center, Paper, Stack, Text, Title } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/dashboard')({
	component: DashboardPage,
});

function DashboardPage() {
	const { session } = Route.useRouteContext();

	return (
		<Center h="100vh">
			<Stack align="center">
				<Title order={1}>Dashboard</Title>
				<Paper shadow="md" p="xl" radius="md" withBorder>
					<Text size="lg">Hello, {session.user.name}!</Text>
					<Text mt="md" c="dimmed">
						This is your dashboard.
					</Text>
				</Paper>
			</Stack>
		</Center>
	);
}
