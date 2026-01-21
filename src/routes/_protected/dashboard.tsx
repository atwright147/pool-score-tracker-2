import {
	ActionIcon,
	Badge,
	Group,
	Paper,
	Stack,
	Text,
	Title,
} from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { and, eq, or } from 'drizzle-orm';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { db } from '~/db/db';
import { friendship } from '~/db/schema';

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

export const Route = createFileRoute('/_protected/dashboard')({
	component: DashboardPage,
	loader: async () => {
		const [requests, friends] = await Promise.all([
			getFriendRequests(),
			getFriends(),
		]);
		return { requests, friends };
	},
});

function DashboardPage() {
	const { session } = Route.useRouteContext();
	const initialData = Route.useLoaderData();
	const [requests, setRequests] = useState(initialData.requests);
	const [friends, setFriends] = useState(initialData.friends);
	const [processingRequest, setProcessingRequest] = useState<number | null>(
		null,
	);

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
		<Stack>
			<Title order={1}>Dashboard</Title>
			<Paper shadow="md" p="xl" radius="md" withBorder>
				<Text size="lg">Hello, {session.user.name}!</Text>
				<Text mt="md" c="dimmed">
					This is your dashboard.
				</Text>
			</Paper>

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
										<Check size={18} />
									</ActionIcon>
									<ActionIcon
										color="red"
										variant="filled"
										size="lg"
										onClick={() => handleFriendRequest(request.id, false)}
										loading={processingRequest === request.id}
										disabled={processingRequest !== null}
									>
										<X size={18} />
									</ActionIcon>
								</Group>
							</Group>
						</Paper>
					))}
				</Stack>
			)}

			{/* Friends List Section */}
			<Stack gap="md">
				<Group justify="space-between">
					<Title order={2}>Your Friends</Title>
					<Badge color="gray" size="lg">
						{friends.length}
					</Badge>
				</Group>
				{friends.length === 0 ? (
					<Paper shadow="sm" p="md" radius="md" withBorder>
						<Text c="dimmed" ta="center">
							No friends yet. Visit the Friends page to add some!
						</Text>
					</Paper>
				) : (
					<Stack gap="sm">
						{friends.map((friend) => (
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
					</Stack>
				)}
			</Stack>
		</Stack>
	);
}
