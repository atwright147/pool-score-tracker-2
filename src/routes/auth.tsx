import {
	Alert,
	Anchor,
	Button,
	Center,
	Container,
	Paper,
	PasswordInput,
	Stack,
	Text,
	TextInput,
	Title,
} from '@mantine/core';
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from '@tanstack/react-router';
import { useId, useState } from 'react';

import { signIn, signUp, useSession } from '~/lib/auth-client';

export const Route = createFileRoute('/auth')({
	component: AuthPage,
	validateSearch: (search: Record<string, unknown>) => {
		return {
			redirect: (search.redirect as string) || '/',
		};
	},
});

function AuthPage() {
	const { data: session, isPending } = useSession();
	const navigate = useNavigate();
	const search = useSearch({ from: '/auth' });
	const [isSignUp, setIsSignUp] = useState(false);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [name, setName] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const nameId = useId();
	const emailId = useId();
	const passwordId = useId();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setLoading(true);

		try {
			if (isSignUp) {
				const result = await signUp.email({
					email,
					password,
					name,
				});
				if (result.error) {
					setError(result.error.message || 'Sign up failed');
					return;
				}
			} else {
				const result = await signIn.email({
					email,
					password,
				});
				if (result.error) {
					setError(result.error.message || 'Sign in failed');
					return;
				}
			}
			// Redirect to the intended page or home
			await navigate({ to: search.redirect as string });
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Authentication failed');
		} finally {
			setLoading(false);
		}
	};

	if (isPending) {
		return (
			<Center h="100vh">
				<Text>Loading...</Text>
			</Center>
		);
	}

	if (session) {
		return (
			<Center h="100vh">
				<Stack align="center">
					<Title order={1}>Welcome, {session.user.name}!</Title>
					<Text c="dimmed">Email: {session.user.email}</Text>
				</Stack>
			</Center>
		);
	}

	return (
		<Center h="100vh">
			<Container size="xs" w="100%">
				<Paper shadow="md" p="xl" radius="md" withBorder>
					<Title order={2} ta="center" mb="lg">
						{isSignUp ? 'Sign Up' : 'Sign In'}
					</Title>

					<form onSubmit={handleSubmit}>
						<Stack gap="md">
							{isSignUp && (
								<TextInput
									id={nameId}
									label="Name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									required={isSignUp}
								/>
							)}

							<TextInput
								id={emailId}
								label="Email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>

							<PasswordInput
								id={passwordId}
								label="Password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
							/>

							{error && (
								<Alert color="red" title="Error">
									{error}
								</Alert>
							)}

							<Button type="submit" fullWidth loading={loading}>
								{isSignUp ? 'Sign Up' : 'Sign In'}
							</Button>
						</Stack>
					</form>

					<Text ta="center" mt="md">
						<Anchor
							component="button"
							type="button"
							onClick={() => setIsSignUp(!isSignUp)}
							size="sm"
						>
							{isSignUp
								? 'Already have an account? Sign in'
								: 'Need an account? Sign up'}
						</Anchor>
					</Text>
				</Paper>
			</Container>
		</Center>
	);
}
