import {
	Avatar,
	Badge,
	Card,
	Divider,
	Group,
	Stack,
	Text,
	ThemeIcon,
	Title,
} from '@mantine/core';
import { IconCalendar, IconMail } from '@tabler/icons-react';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/profile')({
	component: ProfilePage,
});

function ProfilePage() {
	const { session } = Route.useRouteContext();
	const { user } = session;

	const formatDate = (date: Date) => {
		return new Date(date).toLocaleDateString('en-GB', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	};

	return (
		<Stack gap="lg">
			<Title order={1}>Profile</Title>

			<Card shadow="md" padding="xl" radius="md" withBorder>
				<Group align="flex-start" wrap="nowrap">
					<Avatar
						src={user.image}
						alt={user.name}
						size={120}
						radius="md"
						color="blue"
					>
						{user.name.charAt(0).toUpperCase()}
					</Avatar>

					<Stack gap="md" style={{ flex: 1 }}>
						<div>
							<Title order={2}>{user.name}</Title>
							<Text c="dimmed" size="sm">
								User ID: {user.id}
							</Text>
						</div>

						<Divider />

						<Stack gap="sm">
							<Group gap="sm">
								<ThemeIcon variant="light" size="md" radius="md">
									<IconMail size={16} />
								</ThemeIcon>
								<div style={{ flex: 1 }}>
									<Text size="sm" c="dimmed">
										Email
									</Text>
									<Group gap="xs">
										<Text size="sm" fw={500}>
											{user.email}
										</Text>
										{user.emailVerified ? (
											<Badge color="green" variant="light" size="sm">
												Verified
											</Badge>
										) : (
											<Badge color="yellow" variant="light" size="sm">
												Not Verified
											</Badge>
										)}
									</Group>
								</div>
							</Group>

							<Group gap="sm">
								<ThemeIcon variant="light" size="md" radius="md">
									<IconCalendar size={16} />
								</ThemeIcon>
								<div>
									<Text size="sm" c="dimmed">
										Member Since
									</Text>
									<Text size="sm" fw={500}>
										{formatDate(user.createdAt)}
									</Text>
								</div>
							</Group>
						</Stack>
					</Stack>
				</Group>
			</Card>
		</Stack>
	);
}
