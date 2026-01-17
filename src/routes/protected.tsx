import { Center, Paper, Stack, Text, Title } from "@mantine/core";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/protected")({
	beforeLoad: async ({ request }) => {
		// Dynamic import to keep auth on server only
		const { auth } = await import("~/lib/auth");

		// Get session from request headers
		const session = await auth.api.getSession({
			headers: request?.headers || new Headers(),
		});

		if (!session) {
			throw redirect({
				to: "/auth",
				search: {
					redirect: "/protected",
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
						Welcome,{" "}
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
