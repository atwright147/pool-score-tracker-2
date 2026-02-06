import {
	Button,
	Group,
	Paper,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
} from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { and, eq, or, sql } from 'drizzle-orm';
import React, { useState } from 'react';

import { FriendAddModal } from '~/components/FriendAddModal';
import { db } from '~/db/db';
import { friendship, player } from '~/db/schema';
import styles from '~/routes/_protected/friends.module.css';

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

// Server function to fetch pending friend requests (received)
const getPendingRequests = createServerFn({ method: 'GET' }).handler(
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

		// Find pending requests where current user is the addressee
		const pendingRequests = await db.query.friendship.findMany({
			where: and(
				eq(friendship.addresseeId, currentPlayer.id),
				eq(friendship.status, 'pending'),
			),
			with: {
				requester: true,
			},
		});

		return pendingRequests.map((req) => ({
			friendshipId: req.id,
			...req.requester,
		}));
	},
);

// Server function to fetch sent pending requests
const getSentRequests = createServerFn({ method: 'GET' }).handler(async () => {
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

	// Find pending requests where current user is the requester
	const sentRequests = await db.query.friendship.findMany({
		where: and(
			eq(friendship.requesterId, currentPlayer.id),
			eq(friendship.status, 'pending'),
		),
		with: {
			addressee: true,
		},
	});

	return sentRequests.map((req) => req.addressee);
});

// Server function to fetch declined friend requests
const getDeclinedRequests = createServerFn({ method: 'GET' }).handler(
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

		// Find declined requests where current user is involved
		const declinedRequests = await db.query.friendship.findMany({
			where: and(
				or(
					eq(friendship.requesterId, currentPlayer.id),
					eq(friendship.addresseeId, currentPlayer.id),
				),
				eq(friendship.status, 'declined'),
			),
			with: {
				requester: true,
				addressee: true,
			},
		});

		return declinedRequests.map((req) => ({
			friendshipId: req.id,
			player:
				req.requesterId === currentPlayer.id ? req.addressee : req.requester,
			wasRequester: req.requesterId === currentPlayer.id,
		}));
	},
);

// Server function to search players by name
const searchPlayers = createServerFn({ method: 'POST' })
	.inputValidator((query: string) => query)
	.handler(async ({ data }) => {
		try {
			const { auth } = await import('~/lib/auth');
			const headers = getRequestHeaders();
			const session = await auth.api.getSession({ headers });

			if (!session?.user.id || !data || data.trim().length < 2) {
				return [];
			}

			const currentPlayer = await db.query.player.findFirst({
				where: (player, { eq }) => eq(player.userId, session.user.id),
			});

			if (!currentPlayer) {
				return [];
			}

			// Get existing friendships (both pending and accepted)
			const existingFriendships = await db.query.friendship.findMany({
				where: or(
					eq(friendship.requesterId, currentPlayer.id),
					eq(friendship.addresseeId, currentPlayer.id),
				),
			});

			// Get IDs of all players with existing friendship relationships
			const excludedPlayerIds = new Set(
				existingFriendships.map((f) =>
					f.requesterId === currentPlayer.id ? f.addresseeId : f.requesterId,
				),
			);

			// Search for players by display name (excluding current user)
			const searchTerm = `%${data}%`;
			const results = await db.query.player.findMany({
				where: sql`lower(${player.displayName}) like lower(${searchTerm})`,
				with: {
					user: true,
				},
				limit: 10,
			});

			// Filter out current user, existing friends, and pending requests
			return results
				.filter(
					(p) => p.id !== currentPlayer.id && !excludedPlayerIds.has(p.id),
				)
				.map((p) => ({
					id: p.id,
					userId: p.userId,
					displayName: p.displayName,
					skillLevel: p.skillLevel,
					gamesPlayed: p.gamesPlayed,
					gamesWon: p.gamesWon,
					email: p.user.email,
				}));
		} catch (error) {
			console.error('Search error:', error);
			return [];
		}
	});

// Server function to create a friend request
const createFriendRequest = createServerFn({ method: 'POST' })
	.inputValidator((addresseeId: string) => addresseeId)
	.handler(async ({ data: addresseeId }) => {
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

		// Check if friendship already exists
		const existingFriendship = await db.query.friendship.findFirst({
			where: or(
				and(
					eq(friendship.requesterId, currentPlayer.id),
					eq(friendship.addresseeId, addresseeId),
				),
				and(
					eq(friendship.requesterId, addresseeId),
					eq(friendship.addresseeId, currentPlayer.id),
				),
			),
		});

		if (existingFriendship) {
			throw new Error('Friendship request already exists');
		}

		// Create the friend request
		await db.insert(friendship).values({
			requesterId: currentPlayer.id,
			addresseeId,
			status: 'pending',
		});

		return { success: true };
	});

// Server function to accept a friend request
const acceptFriendRequest = createServerFn({ method: 'POST' })
	.inputValidator((friendshipId: number) => friendshipId)
	.handler(async ({ data: friendshipId }) => {
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

		// Verify the current user is the addressee
		const friendshipRecord = await db.query.friendship.findFirst({
			where: and(
				eq(friendship.id, friendshipId),
				eq(friendship.addresseeId, currentPlayer.id),
				eq(friendship.status, 'pending'),
			),
		});

		if (!friendshipRecord) {
			throw new Error('Friend request not found or already processed');
		}

		// Update status to accepted
		await db
			.update(friendship)
			.set({ status: 'accepted', updatedAt: new Date() })
			.where(eq(friendship.id, friendshipId));

		return { success: true };
	});

// Server function to decline a friend request
const declineFriendRequest = createServerFn({ method: 'POST' })
	.inputValidator((friendshipId: number) => friendshipId)
	.handler(async ({ data: friendshipId }) => {
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

		// Verify the current user is the addressee
		const friendshipRecord = await db.query.friendship.findFirst({
			where: and(
				eq(friendship.id, friendshipId),
				eq(friendship.addresseeId, currentPlayer.id),
				eq(friendship.status, 'pending'),
			),
		});

		if (!friendshipRecord) {
			throw new Error('Friend request not found or already processed');
		}

		// Update status to declined
		await db
			.update(friendship)
			.set({ status: 'declined', updatedAt: new Date() })
			.where(eq(friendship.id, friendshipId));

		return { success: true };
	});

export const Route = createFileRoute('/_protected/friends')({
	component: FriendsPage,
	loader: async () => {
		const [friends, pendingRequests, sentRequests, declinedRequests] =
			await Promise.all([
				getFriends(),
				getPendingRequests(),
				getSentRequests(),
				getDeclinedRequests(),
			]);

		return {
			friends,
			pendingRequests,
			sentRequests,
			declinedRequests,
		};
	},
});

interface PlayerToAdd {
	id: string;
	displayName: string;
}

function FriendsPage() {
	const loaderData = Route.useLoaderData();
	const friends = loaderData?.friends ?? [];
	const pendingRequests = loaderData?.pendingRequests ?? [];
	const sentRequests = loaderData?.sentRequests ?? [];
	const declinedRequests = loaderData?.declinedRequests ?? [];

	const [searchQuery, setSearchQuery] = useState('');
	const [debouncedQuery] = useDebouncedValue(searchQuery, 300);
	const [opened, { open, close }] = useDisclosure(false);
	const [_playerToAdd, setPlayerToAdd] = useState<null | PlayerToAdd>(null);
	const [searchResults, setSearchResults] = useState<
		Array<{
			id: string;
			displayName: string;
			skillLevel: number | null;
			gamesPlayed: number;
			gamesWon: number;
			email: string;
		}>
	>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [processingRequest, setProcessingRequest] = useState<number | null>(
		null,
	);

	const handleTableOnClick = (playerToAdd: PlayerToAdd | null): void => {
		console.info(playerToAdd);
		if (!playerToAdd) return;

		open();
		setPlayerToAdd(playerToAdd);
	};

	const handleAddFriend = async () => {
		if (!_playerToAdd) return;

		setIsSubmitting(true);
		try {
			await createFriendRequest({ data: _playerToAdd.id });
			// Clear search and results after successful request
			setSearchQuery('');
			setSearchResults([]);
			setPlayerToAdd(null);
			// Reload the page to refresh all lists
			window.location.reload();
		} catch (error) {
			console.error('Failed to send friend request:', error);
			// You might want to show an error notification here
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleAcceptRequest = async (friendshipId: number) => {
		setProcessingRequest(friendshipId);
		try {
			await acceptFriendRequest({ data: friendshipId });
			window.location.reload();
		} catch (error) {
			console.error('Failed to accept friend request:', error);
		} finally {
			setProcessingRequest(null);
		}
	};

	const handleDeclineRequest = async (friendshipId: number) => {
		setProcessingRequest(friendshipId);
		try {
			await declineFriendRequest({ data: friendshipId });
			window.location.reload();
		} catch (error) {
			console.error('Failed to decline friend request:', error);
		} finally {
			setProcessingRequest(null);
		}
	};

	// Perform search when debounced query changes
	React.useEffect(() => {
		if (debouncedQuery.trim().length >= 2) {
			searchPlayers({ data: debouncedQuery })
				.then((results) => setSearchResults(results || []))
				.catch((error) => {
					console.error('Search error:', error);
					setSearchResults([]);
				});
		} else {
			setSearchResults([]);
		}
	}, [debouncedQuery]);

	return (
		<>
			<Stack>
				<Title order={1}>Friends</Title>
				{/* Search Section */}
				<Stack gap="md">
					<TextInput
						placeholder="Search for players by name…"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.currentTarget.value)}
						size="md"
					/>
					{searchResults?.length > 0 && (
						<Paper shadow="md" p="md" radius="md" withBorder>
							<Title order={3} mb="md">
								Search Results
							</Title>
							<Table striped highlightOnHover className={styles.table}>
								<Table.Thead>
									<Table.Tr>
										<Table.Th>Name</Table.Th>
										<Table.Th>Email</Table.Th>
										<Table.Th>Skill Level</Table.Th>
										<Table.Th>Games Played</Table.Th>
										<Table.Th>Games Won</Table.Th>
										<Table.Th>Win Rate</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{searchResults.map((player) => (
										<Table.Tr
											key={player.id}
											onClick={() => handleTableOnClick(player)}
										>
											<Table.Td fw={600}>{player.displayName}</Table.Td>
											<Table.Td>{player.email}</Table.Td>
											<Table.Td>{player.skillLevel ?? 'N/A'}</Table.Td>
											<Table.Td>{player.gamesPlayed}</Table.Td>
											<Table.Td>{player.gamesWon}</Table.Td>
											<Table.Td>
												{player.gamesPlayed > 0
													? `${Math.round((player.gamesWon / player.gamesPlayed) * 100)}%`
													: 'N/A'}
											</Table.Td>
										</Table.Tr>
									))}
								</Table.Tbody>
							</Table>
						</Paper>
					)}
				</Stack>

				{/* Pending Friend Requests (Received) */}
				{pendingRequests.length > 0 && (
					<>
						<Title order={2} mt="xl">
							Pending Friend Requests
						</Title>
						{pendingRequests.map((request) => (
							<Paper key={request.id} shadow="md" p="md" radius="md" withBorder>
								<Stack gap="sm">
									<div>
										<Text fw={600}>{request.displayName}</Text>
										<Text size="sm" c="dimmed">
											Games: {request.gamesPlayed} | Won: {request.gamesWon}
										</Text>
									</div>
									<div style={{ display: 'flex', gap: '8px' }}>
										<Button
											size="sm"
											color="green"
											onClick={() => handleAcceptRequest(request.friendshipId)}
											loading={processingRequest === request.friendshipId}
										>
											Accept
										</Button>
										<Button
											size="sm"
											color="red"
											variant="outline"
											onClick={() => handleDeclineRequest(request.friendshipId)}
											loading={processingRequest === request.friendshipId}
										>
											Decline
										</Button>
									</div>
								</Stack>
							</Paper>
						))}
					</>
				)}

				<Group grow align="start">
					{/* Sent Friend Requests */}
					{sentRequests.length > 0 && (
						<Stack>
							<Title order={2} mt="xl">
								Pending Friend Requests
							</Title>
							<Text size="sm" c="dimmed" mb="sm">
								Waiting for these players to accept your friend request
							</Text>
							{sentRequests.map((request) => (
								<Paper
									key={request.id}
									shadow="md"
									p="md"
									radius="md"
									withBorder
								>
									<Text fw={600}>{request.displayName}</Text>
									<Text size="sm" c="dimmed">
										Games: {request.gamesPlayed} | Won: {request.gamesWon}
									</Text>
								</Paper>
							))}
						</Stack>
					)}
					{/* Friends List */}
					<Stack>
						<Title order={2} mt="xl">
							Your Friends
						</Title>
						<Text size="sm" c="dimmed" mb="sm">
							Your current friends
						</Text>
						{friends.length === 0 ? (
							<Text c="dimmed">No friends yet</Text>
						) : (
							friends.map((friend) => (
								<Paper
									key={friend.id}
									shadow="md"
									p="md"
									radius="md"
									withBorder
								>
									<Text fw={600}>{friend.displayName}</Text>
									<Text size="sm" c="dimmed">
										Games: {friend.gamesPlayed} | Won: {friend.gamesWon}
									</Text>
								</Paper>
							))
						)}
					</Stack>
					{/* Declined Friend Requests */}
					{declinedRequests.length > 0 && (
						<Stack>
							<Title order={2} mt="xl">
								Declined Friend Requests
							</Title>
							<Text size="sm" c="dimmed" mb="sm">
								Players who declined your friend request
							</Text>

							{declinedRequests.map((request) => (
								<Paper
									key={request.friendshipId}
									shadow="md"
									p="md"
									radius="md"
									withBorder
								>
									<Text fw={600}>{request.player.displayName}</Text>
									<Text size="sm" c="dimmed">
										Games: {request.player.gamesPlayed} | Won:{' '}
										{request.player.gamesWon}
									</Text>
									<Text size="xs" c="dimmed" mt="xs">
										{request.wasRequester
											? 'Your request was declined'
											: 'You declined this request'}
									</Text>
								</Paper>
							))}
						</Stack>
					)}
				</Group>
			</Stack>

			<FriendAddModal
				opened={opened}
				onClose={close}
				onConfirm={handleAddFriend}
				isLoading={isSubmitting}
				message={
					<>
						Are you sure you wish to add{' '}
						<Text span fw={700}>
							{_playerToAdd?.displayName}
						</Text>{' '}
						as a friend?
					</>
				}
			/>
		</>
	);
}
