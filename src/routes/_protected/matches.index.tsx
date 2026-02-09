import {
	Alert,
	Badge,
	Button,
	Group,
	Modal,
	MultiSelect,
	NumberInput,
	Paper,
	Stack,
	Table,
	Text,
	Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconAlertCircle } from '@tabler/icons-react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { useState } from 'react';

import { db } from '~/db/db';
import * as schema from '~/db/schema';

const { matches } = schema;

// Server function to get current player profile
const getCurrentPlayer = createServerFn({ method: 'GET' }).handler(async () => {
	const { auth } = await import('~/lib/auth');
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });

	if (!session?.user.id) return null;

	return await db.query.player.findFirst({
		where: (player, { eq }) => eq(player.userId, session.user.id),
	});
});

// Server function to get current active match for the user
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
			// Find match where current player is one of the participants
			sql`EXISTS (SELECT 1 FROM match_players WHERE match_id = ${matches.id} AND player_id = ${playerProfile.id})`,
		),
		with: {
			matchPlayers: {
				with: {
					player: true,
				},
			},
			games: {
				with: {
					gamePlayers: {
						with: {
							player: true,
						},
					},
				},
			},
		},
		orderBy: desc(matches.createdAt),
	});
});

// Server function to get previous matches for the user
const getPreviousMatches = createServerFn({ method: 'GET' }).handler(
	async () => {
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
				games: true,
			},
			orderBy: desc(matches.createdAt),
			limit: 50,
		});
	},
);

// Server function to get all players for selection
const getPlayers = createServerFn({ method: 'GET' }).handler(async () => {
	const { auth } = await import('~/lib/auth');
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });

	if (!session?.user.id) return [];

	return await db.query.player.findMany({
		orderBy: (player, { asc }) => [asc(player.displayName)],
	});
});

// Server function to create a new match
const createMatch = createServerFn({ method: 'POST' })
	.inputValidator((data: { playerIds: string[] }) => data)
	.handler(async ({ data }: { data: { playerIds: string[] } }) => {
		const { auth } = await import('~/lib/auth');
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session?.user.id) throw new Error('Not authenticated');

		const playerProfile = await db.query.player.findFirst({
			where: (player, { eq }) => eq(player.userId, session.user.id),
		});

		if (!playerProfile) throw new Error('Player profile not found');

		const activeMatch = await db.query.matches.findFirst({
			where: and(
				eq(matches.status, 'active'),
				sql`EXISTS (SELECT 1 FROM match_players WHERE match_id = ${matches.id} AND player_id = ${playerProfile.id})`,
			),
		});

		if (activeMatch) throw new Error('There is already an active match');

		const newMatch = db.transaction((tx) => {
			const match = tx
				.insert(matches)
				.values({
					status: 'active',
				})
				.returning()
				.get();

			const matchPlayersData = data.playerIds.map((playerId) => ({
				matchId: match.id,
				playerId,
				score: 0,
			}));

			tx.insert(schema.matchPlayers).values(matchPlayersData).run();

			return match;
		});

		return newMatch;
	});

// Server function to end a match
const endMatch = createServerFn({ method: 'POST' })
	.inputValidator(
		(data: {
			matchId: number;
			winnerId?: string;
			playerScores?: { playerId: string; score: number }[];
			status?: 'finished' | 'abandoned';
		}) => data,
	)
	.handler(async ({ data }) => {
		const { auth } = await import('~/lib/auth');
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session?.user.id) throw new Error('Not authenticated');

		if (data.status === 'abandoned') {
			db.update(matches)
				.set({
					status: 'abandoned',
					finishedAt: new Date(),
				})
				.where(eq(matches.id, data.matchId))
				.run();
			return { success: true };
		}

		db.transaction((tx) => {
			tx.update(matches)
				.set({
					status: data.status || 'finished',
					winnerId: data.winnerId || null,
					finishedAt: new Date(),
				})
				.where(eq(matches.id, data.matchId))
				.run();

			if (data.playerScores) {
				for (const ps of data.playerScores) {
					tx.update(schema.matchPlayers)
						.set({ score: ps.score })
						.where(
							and(
								eq(schema.matchPlayers.matchId, data.matchId),
								eq(schema.matchPlayers.playerId, ps.playerId),
							),
						)
						.run();
				}
			}
		});

		return { success: true };
	});

export const Route = createFileRoute('/_protected/matches/')({
	component: MatchesPage,
	loader: async () => {
		const [currentMatch, previousMatches, players, currentPlayer] =
			await Promise.all([
				getCurrentMatch(),
				getPreviousMatches(),
				getPlayers(),
				getCurrentPlayer(),
			]);
		return { currentMatch, previousMatches, players, currentPlayer };
	},
});

function PlayerName({ name, isMe }: { name: string; isMe: boolean }) {
	return (
		<Group gap="xs" wrap="nowrap" style={{ display: 'inline-flex' }}>
			<Text span fw={isMe ? 700 : 400}>
				{name}
			</Text>
			{isMe && (
				<Badge size="xs" variant="light" color="blue">
					You
				</Badge>
			)}
		</Group>
	);
}

function MatchesPage() {
	const { currentMatch, previousMatches, players, currentPlayer } =
		Route.useLoaderData();
	const router = useRouter();
	const [opened, { open, close }] = useDisclosure(false);
	const [endMatchOpened, { open: openEndMatch, close: closeEndMatch }] =
		useDisclosure(false);
	const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
	const [matchScores, setMatchScores] = useState<Record<string, number>>({});
	const [creating, setCreating] = useState(false);
	const [ending, setEnding] = useState(false);

	const handleCreateMatch = async () => {
		if (selectedPlayerIds.length < 2) return;
		setCreating(true);
		try {
			await createMatch({ data: { playerIds: selectedPlayerIds } });
			setSelectedPlayerIds([]);
			close();
			await router.invalidate();
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Failed to create match');
		} finally {
			setCreating(false);
		}
	};

	const handleOpenEndMatch = () => {
		const scores: Record<string, number> = {};
		currentMatch?.matchPlayers?.forEach((mp) => {
			scores[mp.playerId] = mp.score || 0;
		});
		setMatchScores(scores);
		openEndMatch();
	};

	const handleConfirmEndMatch = async () => {
		if (!currentMatch) return;
		setEnding(true);
		try {
			// Find winner (highest score)
			let winnerId: string | undefined;
			let maxScore = -1;
			const playerScores = Object.entries(matchScores).map(
				([playerId, score]) => {
					if (score > maxScore) {
						maxScore = score;
						winnerId = playerId;
					}
					return { playerId, score };
				},
			);

			await endMatch({
				data: {
					matchId: currentMatch.id,
					winnerId,
					playerScores,
					status: 'finished',
				},
			});
			closeEndMatch();
			await router.invalidate();
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Failed to end match');
		} finally {
			setEnding(false);
		}
	};

	const handleAbandonMatch = async () => {
		if (!currentMatch) return;
		if (!confirm('Are you sure you want to abandon this match?')) return;
		try {
			await endMatch({
				data: {
					matchId: currentMatch.id,
					status: 'abandoned',
				},
			});
			await router.invalidate();
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Failed to abandon match');
		}
	};

	const handleCloseCreateModal = () => {
		setSelectedPlayerIds([]);
		close();
	};

	const playerOptions = (players || []).map((p) => ({
		value: p.id,
		label: p.displayName,
	}));

	return (
		<Stack gap="xl">
			<Group justify="space-between">
				<Title order={1}>Matches</Title>
				<Button onClick={open}>Create New Match</Button>
			</Group>

			{currentMatch && (
				<Paper shadow="sm" p="md" withBorder>
					<Stack gap="md">
						<Group justify="space-between">
							<Title order={2}>Current Match</Title>
							<Group>
								<Button
									variant="outline"
									component={Link}
									to={`/matches/${currentMatch.id}`}
								>
									View
								</Button>

								<Button
									variant="outline"
									color="red"
									onClick={handleAbandonMatch}
								>
									Abandon
								</Button>
								<Button onClick={handleOpenEndMatch}>End Match</Button>
							</Group>
						</Group>

						<Group gap="xl" justify="center" wrap="wrap">
							{currentMatch.matchPlayers?.map((mp, index) => (
								<Stack key={mp.playerId} align="center" gap="xs">
									<Text size="sm" c="dimmed">
										Player {index + 1}
									</Text>
									<PlayerName
										name={mp.player.displayName}
										isMe={currentPlayer?.id === mp.playerId}
									/>
									<Text size="xl" fw={700}>
										{mp.score || 0}
									</Text>
								</Stack>
							))}
						</Group>
					</Stack>
				</Paper>
			)}

			<Paper shadow="sm" p="md" withBorder>
				<Title order={2} mb="md">
					Previous Matches
				</Title>
				{previousMatches.length === 0 ? (
					<Text c="dimmed">No previous matches found</Text>
				) : (
					<Table.ScrollContainer minWidth={500}>
					<Table striped highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Date</Table.Th>
								<Table.Th>Participants</Table.Th>
								<Table.Th>Winner</Table.Th>
								<Table.Th>Status</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{previousMatches.map((match) => (
								<Table.Tr
									key={match.id}
									onClick={() =>
										router.navigate({
											to: `/matches/${match.id}`,
										})
									}
									style={{ cursor: 'pointer' }}
								>
									<Table.Td>
										{match.createdAt
											? new Date(match.createdAt).toLocaleDateString()
											: 'N/A'}
									</Table.Td>
									<Table.Td>
										<Group gap="xs">
											{match.matchPlayers?.map((mp, idx) => (
												<span key={mp.playerId}>
													<PlayerName
														name={mp.player.displayName}
														isMe={currentPlayer?.id === mp.playerId}
													/>
													{idx < (match.matchPlayers?.length || 0) - 1
														? ', '
														: ''}
												</span>
											))}
										</Group>
									</Table.Td>
									<Table.Td>
										{match.winner ? (
											<PlayerName
												name={match.winner.displayName}
												isMe={currentPlayer?.id === match.winnerId}
											/>
										) : (
											'N/A'
										)}
									</Table.Td>
									<Table.Td>
										<Text c={match.status === 'finished' ? 'green' : 'red'}>
											{match.status}
										</Text>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
					</Table.ScrollContainer>
				)}
			</Paper>

			<Modal
				opened={opened}
				onClose={handleCloseCreateModal}
				title="Create New Match"
			>
				<Stack gap="md">
					{currentMatch && (
						<Alert
							icon={<IconAlertCircle size={16} />}
							title="Active Match Exists"
							color="yellow"
						>
							End your current match before starting a new one.
						</Alert>
					)}

					<MultiSelect
						label="Select Players (2-8)"
						placeholder="Pick participants"
						data={playerOptions}
						value={selectedPlayerIds}
						onChange={setSelectedPlayerIds}
						maxValues={8}
						hidePickedOptions
						searchable
						disabled={!!currentMatch}
					/>

					<Group justify="flex-end" mt="md">
						<Button variant="subtle" onClick={handleCloseCreateModal}>
							Cancel
						</Button>
						<Button
							onClick={handleCreateMatch}
							disabled={
								!!currentMatch || selectedPlayerIds.length < 2 || creating
							}
							loading={creating}
						>
							Create Match
						</Button>
					</Group>
				</Stack>
			</Modal>

			<Modal
				opened={endMatchOpened}
				onClose={closeEndMatch}
				title="End Match & Enter Scores"
			>
				<Stack gap="md">
					<Text size="sm" c="dimmed">
						Enter the final scores for each player. The player with the highest
						score will be marked as the winner.
					</Text>

					{currentMatch?.matchPlayers?.map((mp) => (
						<NumberInput
							key={mp.playerId}
							label={mp.player.displayName}
							value={matchScores[mp.playerId] || 0}
							onChange={(val) =>
								setMatchScores({ ...matchScores, [mp.playerId]: Number(val) })
							}
							min={0}
						/>
					))}

					<Group justify="flex-end" mt="md">
						<Button variant="subtle" onClick={closeEndMatch}>
							Cancel
						</Button>
						<Button onClick={handleConfirmEndMatch} loading={ending}>
							Confirm & End Match
						</Button>
					</Group>
				</Stack>
			</Modal>
		</Stack>
	);
}
