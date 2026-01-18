import {
	Button,
	Center,
	Container,
	Paper,
	Stack,
	Text,
	Title,
} from '@mantine/core';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { signOut, useSession } from '~/lib/auth-client';

export const Route = createFileRoute('/logout')({
	component: LogoutPage,
});

function LogoutPage() {
	const { data: session, isPending } = useSession();
	const navigate = useNavigate();
	const [isSigningOut, setIsSigningOut] = useState(false);
	const [error, setError] = useState('');

	const handleSignOut = async () => {
		setIsSigningOut(true);
		setError('');
		try {
			await signOut();
			// Redirect to home page after successful logout
			navigate({ to: '/' });
		} catch (err) {
			console.error('Sign out failed:', err);
			setError('Failed to sign out. Please try again.');
		} finally {
			setIsSigningOut(false);
		}
	};

	// If user is not logged in, redirect to home
	useEffect(() => {
		if (!isPending && !session) {
			navigate({ to: '/' });
		}
	}, [session, isPending, navigate]);

	if (isPending) {
		return (
			<Container size="xs" py="xl">
				<Center>
					<Text>Loading...</Text>
				</Center>
			</Container>
		);
	}

	if (!session) {
		return null;
	}

	return (
		<Container size="xs" py="xl">
			<Center>
				<Paper withBorder shadow="md" p="xl" radius="md" w="100%">
					<Stack gap="lg">
						<Title order={2} ta="center">
							Sign Out
						</Title>

						<Text ta="center" c="dimmed">
							Are you sure you want to sign out?
						</Text>

						{session && (
							<Text ta="center" size="sm">
								Currently signed in as: <strong>{session.user.email}</strong>
							</Text>
						)}

						{error && (
							<Text c="red" size="sm" ta="center">
								{error}
							</Text>
						)}

						<Stack gap="sm">
							<Button
								color="red"
								onClick={handleSignOut}
								loading={isSigningOut}
								fullWidth
							>
								Sign Out
							</Button>

							<Button
								variant="subtle"
								onClick={() => navigate({ to: '/' })}
								disabled={isSigningOut}
								fullWidth
							>
								Cancel
							</Button>
						</Stack>
					</Stack>
				</Paper>
			</Center>
		</Container>
	);
}
