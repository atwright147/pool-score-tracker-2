import {
	ActionIcon,
	Badge,
	Button,
	Group,
	Paper,
	Stack,
	Table,
	Text,
	ThemeIcon,
	Title,
} from '@mantine/core';
import {
	IconCheck,
	IconDice6,
	IconHistory,
	IconTarget,
	IconTrendingUp,
	IconX,
} from '@tabler/icons-react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { and, desc, eq, ne, or, sql } from 'drizzle-orm';
import { useState } from 'react';
import { db } from '~/db/db';
import { friendship, matches } from '~/db/schema';

// Server function to fetch friend requests
const getFriendRequests = createServerFn({ method: 'GET' }).handler(
	async () => {
		const { auth } = await import('~/lib/auth');
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session?.user.id) {
			return [];
		}

		const currentPlayer = await db.query.player.findFirst({
			where: (player, { eq }) => eq(player.userId, session.user.id),
		});

		if (!currentPlayer) {
			return [];
		}

		// Find pending friend requests where current user is the addressee
		const requests = await db.query.friendship.findMany({
			where: and(
				eq(friendship.addresseeId, currentPlayer.id),
				eq(friendship.status, 'pending'),
			),
			with: {
				requester: true,
			},
		});

		return requests.map((r) => ({
			id: r.id,
			requester: r.requester,
			createdAt: r.createdAt,
		}));
	},
);

// Server function to fetch friends
const getFriends = createServerFn({ method: 'GET' }).handler(async () => {
	const { auth } = await import('~/lib/auth');
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });

	if (!session?.user.id) {
		return [];
	}

	const currentPlayer = await db.query.player.findFirst({
		where: (player, { eq }) => eq(player.userId, session.user.id),
	});

	if (!currentPlayer) {
		return [];
	}

	// Find all accepted friendships where user is requester or addressee
	const friends = await db.query.friendship.findMany({
		where: and(
			or(
				eq(friendship.requesterId, currentPlayer.id),
				eq(friendship.addresseeId, currentPlayer.id),
			),
			eq(friendship.status, 'accepted'),
		),
		with: {
			requester: true,
			addressee: true,
		},
	});

	// Map to return the friend (not the current user)
	return friends.map((f) =>
		f.requesterId === currentPlayer.id ? f.addressee : f.requester,
	);
});

// Server function to respond to a friend request
const respondToFriendRequest = createServerFn({ method: 'POST' })
	.inputValidator((data: { requestId: number; accept: boolean }) => data)
	.handler(async ({ data }) => {
		const { auth } = await import('~/lib/auth');
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session?.user.id) {
			throw new Error('Not authenticated');
		}

		const currentPlayer = await db.query.player.findFirst({
			where: (player, { eq }) => eq(player.userId, session.user.id),
		});

		if (!currentPlayer) {
			throw new Error('Player profile not found');
		}

		// Verify the request exists and is for this user
		const request = await db.query.friendship.findFirst({
			where: and(
				eq(friendship.id, data.requestId),
				eq(friendship.addresseeId, currentPlayer.id),
				eq(friendship.status, 'pending'),
			),
		});

		if (!request) {
			throw new Error('Friend request not found');
		}

		// Update the status
		await db
			.update(friendship)
			.set({
				status: data.accept ? 'accepted' : 'declined',
				updatedAt: new Date(),
			})
			.where(eq(friendship.id, data.requestId));

		return { success: true };
	});

// Server function to get current match
const getCurrentMatch = createServerFn({ method: 'GET' }).handler(async () => {
	const { auth } = await import('~/lib/auth');
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });

	if (!session?.user.id) return null;

	const playerProfile = await db.query.player.findFirst({
		where: (player, { eq }) => eq(player.userId, session.user.id),
	});

	if (!playerProfile) return null;

	return await db.query.matches.findFirst({
		where: and(
			eq(matches.status, 'active'),
			sql`EXISTS (SELECT 1 FROM match_players WHERE match_id = ${matches.id} AND player_id = ${playerProfile.id})`,
		),
		with: {
			matchPlayers: {
				with: {
					player: true,
				},
			},
			games: true,
		},
		orderBy: desc(matches.createdAt),
	});
});

// Server function to get recent matches
const getRecentMatches = createServerFn({ method: 'GET' }).handler(async () => {
	const { auth } = await import('~/lib/auth');
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });

	if (!session?.user.id) return [];

	const playerProfile = await db.query.player.findFirst({
		where: (player, { eq }) => eq(player.userId, session.user.id),
	});

	if (!playerProfile) return [];

	return await db.query.matches.findMany({
		where: and(
			ne(matches.status, 'active'),
			sql`EXISTS (SELECT 1 FROM match_players WHERE match_id = ${matches.id} AND player_id = ${playerProfile.id})`,
		),
		with: {
			matchPlayers: {
				with: {
					player: true,
				},
			},
			winner: true,
		},
		orderBy: desc(matches.createdAt),
		limit: 5,
	});
});

export const Route = createFileRoute('/_protected/dashboard')({
	component: DashboardPage,
	loader: async () => {
		const [requests, friends, currentMatch, recentMatches] = await Promise.all([
			getFriendRequests(),
			getFriends(),
			getCurrentMatch(),
			getRecentMatches(),
		]);
		return { requests, friends, currentMatch, recentMatches };
	},
});

function DashboardPage() {
	const { session } = Route.useRouteContext();
	const _router = useRouter();
	const initialData = Route.useLoaderData();
	const [requests, setRequests] = useState(initialData.requests);
	const [friends, setFriends] = useState(initialData.friends);
	const [processingRequest, setProcessingRequest] = useState<number | null>(
		null,
	);

	const _currentPlayer = session?.user
		? { id: session.user.id, name: session.user.name }
		: null;
	const playerStats = friends.length > 0 ? friends[0] : null;

	const handleFriendRequest = async (
		requestId: number,
		accept: boolean,
	): Promise<void> => {
		setProcessingRequest(requestId);
		try {
			await respondToFriendRequest({ data: { requestId, accept } });
			// Remove from requests
			setRequests(requests.filter((r) => r.id !== requestId));
			// If accepted, refetch friends
			if (accept) {
				const updatedFriends = await getFriends();
				setFriends(updatedFriends);
			}
		} catch (error) {
			console.error('Failed to respond to friend request:', error);
		} finally {
			setProcessingRequest(null);
		}
	};

	return (
		<Stack gap="xl">
			<Group justify="space-between" align="center">
				<div>
					<Title order={1}>Welcome back, {session.user.name}!</Title>
					<Text c="dimmed" mt="xs">
						Here's your pool score tracking dashboard
					</Text>
				</div>
				<Group gap="md">
					<Button
						component={Link}
						to="/matches"
						leftSection={<IconDice6 size={18} />}
					>
						New Match
					</Button>
					<Button
						component={Link}
						to="/insights"
						variant="light"
						leftSection={<IconTrendingUp size={18} />}
					>
						Insights
					</Button>
					<Button component={Link} to="/profile" variant="light">
						Profile
					</Button>
				</Group>
			</Group>

			{/* Statistics Section */}
			<Group grow>
				<Paper shadow="sm" p="md" radius="md" withBorder>
					<Group justify="space-between" mb="xs">
						<Text size="sm" fw={500} c="dimmed">
							Games Played
						</Text>
						<ThemeIcon size="lg" radius="md" variant="light" color="blue">
							<IconDice6 size={18} />
						</ThemeIcon>
					</Group>
					<Text size="xl" fw={700}>
						{playerStats?.gamesPlayed || 0}
					</Text>
				</Paper>

				<Paper shadow="sm" p="md" radius="md" withBorder>
					<Group justify="space-between" mb="xs">
						<Text size="sm" fw={500} c="dimmed">
							Games Won
						</Text>
						<ThemeIcon size="lg" radius="md" variant="light" color="green">
							<IconTarget size={18} />
						</ThemeIcon>
					</Group>
					<Text size="xl" fw={700}>
						{playerStats?.gamesWon || 0}
					</Text>
				</Paper>

				<Paper shadow="sm" p="md" radius="md" withBorder>
					<Group justify="space-between" mb="xs">
						<Text size="sm" fw={500} c="dimmed">
							Win Rate
						</Text>
						<ThemeIcon size="lg" radius="md" variant="light" color="cyan">
							<IconTrendingUp size={18} />
						</ThemeIcon>
					</Group>
					<Text size="xl" fw={700}>
						{playerStats && playerStats.gamesPlayed > 0
							? `${Math.round((playerStats.gamesWon / playerStats.gamesPlayed) * 100)}%`
							: '—'}
					</Text>
				</Paper>
			</Group>

			{/* Active Match Section */}
			{initialData.currentMatch ? (
				<Paper shadow="md" p="md" radius="md" withBorder>
					<Group justify="space-between" mb="md">
						<Title order={2}>Active Match</Title>
						<Badge color="green" variant="filled">
							In Progress
						</Badge>
					</Group>
					<Group justify="space-between">
						<Stack gap="sm" style={{ flex: 1 }}>
							{initialData.currentMatch.matchPlayers?.map((mp) => (
								<Group key={mp.playerId} justify="space-between">
									<Text fw={500}>{mp.player.displayName}</Text>
									<Badge color="blue" variant="light">
										Score: {mp.score || 0}
									</Badge>
								</Group>
							))}
						</Stack>
						<Button
							component={Link}
							to={`/matches/${initialData.currentMatch.id}`}
						>
							Continue Match
						</Button>
					</Group>
				</Paper>
			) : null}

			{/* Friend Requests Section */}
			{requests.length > 0 && (
				<Stack gap="md">
					<Group>
						<Title order={2}>Friend Requests</Title>
						<Badge color="blue" size="lg">
							{requests.length}
						</Badge>
					</Group>
					{requests.map((request) => (
						<Paper key={request.id} shadow="sm" p="md" radius="md" withBorder>
							<Group justify="space-between">
								<div>
									<Text fw={600}>{request.requester.displayName}</Text>
									<Text size="sm" c="dimmed">
										Sent{' '}
										{new Date(request.createdAt ?? '').toLocaleDateString(
											'en-US',
											{
												month: 'short',
												day: 'numeric',
												year: 'numeric',
											},
										)}
									</Text>
								</div>
								<Group gap="xs">
									<ActionIcon
										color="green"
										variant="filled"
										size="lg"
										onClick={() => handleFriendRequest(request.id, true)}
										loading={processingRequest === request.id}
										disabled={processingRequest !== null}
									>
										<IconCheck size={18} />
									</ActionIcon>
									<ActionIcon
										color="red"
										variant="filled"
										size="lg"
										onClick={() => handleFriendRequest(request.id, false)}
										loading={processingRequest === request.id}
										disabled={processingRequest !== null}
									>
										<IconX size={18} />
									</ActionIcon>
								</Group>
							</Group>
						</Paper>
					))}
				</Stack>
			)}

			{/* Recent Matches Section */}
			<Stack gap="md">
				<Group justify="space-between">
					<Title order={2}>Recent Matches</Title>
					<Button
						component={Link}
						to="/matches"
						variant="subtle"
						rightSection={<IconHistory size={16} />}
					>
						View All
					</Button>
				</Group>
				{initialData.recentMatches.length === 0 ? (
					<Paper shadow="sm" p="md" radius="md" withBorder>
						<Text c="dimmed" ta="center">
							No matches yet. Create your first match to get started!
						</Text>
					</Paper>
				) : (
					<Table.ScrollContainer minWidth={500}>
						<Table striped highlightOnHover>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Match ID</Table.Th>
									<Table.Th>Opponents</Table.Th>
									<Table.Th>Result</Table.Th>
									<Table.Th>Games</Table.Th>
									<Table.Th>Date</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{initialData.recentMatches.map((match) => {
									const isWinner = match.winnerId === playerStats?.id;
									const opponents = match.matchPlayers
										?.filter((mp) => mp.playerId !== playerStats?.id)
										?.map((mp) => mp.player.displayName)
										?.join(', ');

									return (
										<Table.Tr
											key={match.id}
											style={{ cursor: 'pointer' }}
											onClick={() =>
												_router.navigate({
													to: `/matches/${match.id}`,
												})
											}
										>
											<Table.Td>
												<Text fw={500}>#{match.id}</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm">{opponents}</Text>
											</Table.Td>
											<Table.Td>
												<Badge
													color={isWinner ? 'green' : 'gray'}
													variant="light"
												>
													{isWinner ? 'Won' : 'Lost'}
												</Badge>
											</Table.Td>
											<Table.Td>
												<Text size="sm">{match.games?.length || 0}</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm" c="dimmed">
													{new Date(match.createdAt || '').toLocaleDateString(
														'en-US',
														{
															month: 'short',
															day: 'numeric',
														},
													)}
												</Text>
											</Table.Td>
										</Table.Tr>
									);
								})}
							</Table.Tbody>
						</Table>
					</Table.ScrollContainer>
				)}
			</Stack>

			{/* Friends List Section */}
			<Stack gap="md">
				<Group justify="space-between">
					<Title order={2}>Your Friends</Title>
					<Group gap="xs">
						<Badge color="gray" size="lg">
							{friends.length}
						</Badge>
						<Button component={Link} to="/_protected/friends" variant="subtle">
							Manage
						</Button>
					</Group>
				</Group>
				{friends.length === 0 ? (
					<Paper shadow="sm" p="md" radius="md" withBorder>
						<Text c="dimmed" ta="center">
							No friends yet. Visit the Friends page to add some!
						</Text>
					</Paper>
				) : (
					<Stack gap="sm">
						{friends.slice(0, 5).map((friend) => (
							<Paper key={friend.id} shadow="sm" p="md" radius="md" withBorder>
								<Group justify="space-between">
									<div>
										<Text fw={600}>{friend.displayName}</Text>
										<Text size="sm" c="dimmed">
											Games: {friend.gamesPlayed} | Won: {friend.gamesWon}
											{friend.gamesPlayed > 0 &&
												` | Win Rate: ${Math.round((friend.gamesWon / friend.gamesPlayed) * 100)}%`}
										</Text>
									</div>
									{friend.skillLevel && (
										<Badge color="blue" variant="light">
											Skill: {friend.skillLevel}
										</Badge>
									)}
								</Group>
							</Paper>
						))}
						{friends.length > 5 && (
							<Text c="dimmed" size="sm" ta="center">
								+{friends.length - 5} more friends
							</Text>
						)}
					</Stack>
				)}
			</Stack>
		</Stack>
	);
}
