import {
	Anchor,
	Badge,
	Breadcrumbs,
	Button,
	Card,
	Divider,
	Group,
	Modal,
	NumberInput,
	Paper,
	Select,
	Stack,
	Text,
	Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { and, eq } from 'drizzle-orm';
import { useEffect, useState } from 'react';

import { db } from '~/db/db';
import * as schema from '~/db/schema';

const { matches } = schema;

const getMatch = createServerFn({ method: 'GET' })
	.inputValidator((matchId: number) => matchId)
	.handler(async ({ data: matchId }) => {
		const { auth } = await import('~/lib/auth');
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session?.user.id) return null;

		return await db.query.matches.findFirst({
			where: eq(matches.id, matchId),
			with: {
				matchPlayers: {
					with: {
						player: true,
					},
				},
				winner: true,
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
		});
	});

const getCurrentPlayer = createServerFn({ method: 'GET' }).handler(async () => {
	const { auth } = await import('~/lib/auth');
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });

	if (!session?.user.id) return null;

	return await db.query.player.findFirst({
		where: (player, { eq }) => eq(player.userId, session.user.id),
	});
});

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

const startGame = createServerFn({ method: 'POST' })
	.inputValidator(
		(data: { matchId: number; player1Id: string; player2Id: string }) => data,
	)
	.handler(async ({ data }) => {
		const { auth } = await import('~/lib/auth');
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session?.user.id) throw new Error('Not authenticated');

		// Check if there's already an active game for this match
		const activeGame = await db.query.games.findFirst({
			where: (games, { and, eq }) =>
				and(eq(games.matchId, data.matchId), eq(games.status, 'active')),
		});

		if (activeGame) throw new Error('A game is already in progress');

		// Get number of existing games (read outside transaction)
		const existingGames = await db.query.games.findMany({
			where: eq(schema.games.matchId, data.matchId),
		});

		const gameNumber = (existingGames?.length || 0) + 1;

		// Execute writes in transaction
		return db.transaction((tx) => {
			const [newGame] = tx
				.insert(schema.games)
				.values({
					matchId: data.matchId,
					gameNumber,
					status: 'active',
				})
				.returning()
				.all();

			tx.insert(schema.gamePlayers)
				.values([
					{ gameId: newGame.id, playerId: data.player1Id },
					{ gameId: newGame.id, playerId: data.player2Id },
				])
				.run();

			return newGame;
		});
	});

const recordGameWin = createServerFn({ method: 'POST' })
	.inputValidator((data: { gameId: number; winnerId: string }) => data)
	.handler(async ({ data }) => {
		const { auth } = await import('~/lib/auth');
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session?.user.id) throw new Error('Not authenticated');

		// Read game data outside transaction
		const game = await db.query.games.findFirst({
			where: eq(schema.games.id, data.gameId),
		});

		if (!game) throw new Error('Game not found');

		const matchPlayer = await db.query.matchPlayers.findFirst({
			where: and(
				eq(schema.matchPlayers.matchId, game.matchId),
				eq(schema.matchPlayers.playerId, data.winnerId),
			),
		});

		const winner = await db.query.player.findFirst({
			where: eq(schema.player.id, data.winnerId),
		});

		const gameParticipants = await db.query.gamePlayers.findMany({
			where: eq(schema.gamePlayers.gameId, data.gameId),
		});

		// Fetch loser players data
		const losers = await Promise.all(
			gameParticipants
				.filter((gp) => gp.playerId !== data.winnerId)
				.map((gp) =>
					db.query.player.findFirst({
						where: eq(schema.player.id, gp.playerId),
					}),
				),
		);

		// Execute writes in transaction
		return db.transaction((tx) => {
			// 1. Update the game with winner and status
			tx.update(schema.games)
				.set({
					winnerId: data.winnerId,
					status: 'finished',
					finishedAt: new Date(),
				})
				.where(eq(schema.games.id, data.gameId))
				.run();

			// 3. Update the match player score (incrementing it)
			if (matchPlayer) {
				tx.update(schema.matchPlayers)
					.set({ score: (matchPlayer.score || 0) + 1 })
					.where(eq(schema.matchPlayers.id, matchPlayer.id))
					.run();
			}

			// Update overall player stats
			if (winner) {
				tx.update(schema.player)
					.set({
						gamesWon: winner.gamesWon + 1,
						gamesPlayed: winner.gamesPlayed + 1,
					})
					.where(eq(schema.player.id, data.winnerId))
					.run();
			}

			for (const gp of gameParticipants) {
				if (gp.playerId !== data.winnerId) {
					const loser = losers.find((p) => p?.id === gp.playerId);
					if (loser) {
						tx.update(schema.player)
							.set({ gamesPlayed: loser.gamesPlayed + 1 })
							.where(eq(schema.player.id, gp.playerId))
							.run();
					}
				}
			}

			return { success: true };
		});
	});

export const Route = createFileRoute('/_protected/matches/$matchId')({
	component: MatchDetailsPage,
	loader: async ({ params }) => {
		const matchId = Number.parseInt(params.matchId, 10);
		if (Number.isNaN(matchId)) throw new Error('Invalid match ID');

		const [match, currentPlayer] = await Promise.all([
			getMatch({ data: matchId }),
			getCurrentPlayer(),
		]);

		if (!match) throw new Error('Match not found');

		return { match, currentPlayer };
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

function MatchDetailsPage() {
	const { match, currentPlayer } = Route.useLoaderData();
	const router = useRouter();
	const [endMatchOpened, { open: openEndMatch, close: closeEndMatch }] =
		useDisclosure(false);
	const [matchScores, setMatchScores] = useState<Record<string, number>>({});
	const [ending, setEnding] = useState(false);

	const [p1, setP1] = useState<string | null>(null);
	const [p2, setP2] = useState<string | null>(null);
	const [startingGame, setStartingGame] = useState(false);
	const [recordingWin, setRecordingWin] = useState(false);

	const activeGame = match.games?.find((g) => g.status === 'active');
	const isParticipant = match.matchPlayers?.some(
		(mp) => mp.playerId === currentPlayer?.id,
	);

	// Initialize scores from match data if available
	useEffect(() => {
		if (match.matchPlayers) {
			const scores: Record<string, number> = {};
			for (const mp of match.matchPlayers) {
				scores[mp.playerId] = mp.score || 0;
			}
			setMatchScores(scores);

			if (match.matchPlayers.length === 2 && !p1 && !p2) {
				setP1(match.matchPlayers[0].playerId);
				setP2(match.matchPlayers[1].playerId);
			}
		}
	}, [match, p1, p2]);

	const handleStartGame = async () => {
		if (!p1 || !p2 || p1 === p2) {
			alert('Please select two different players');
			return;
		}
		setStartingGame(true);
		try {
			await startGame({
				data: { matchId: match.id, player1Id: p1, player2Id: p2 },
			});
			await router.invalidate();
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Failed to start game');
		} finally {
			setStartingGame(false);
		}
	};

	const handleRecordWin = async (winnerId: string) => {
		if (!activeGame) return;
		setRecordingWin(true);
		try {
			await recordGameWin({ data: { gameId: activeGame.id, winnerId } });
			await router.invalidate();
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Failed to record win');
		} finally {
			setRecordingWin(false);
		}
	};

	const handleConfirmEndMatch = async () => {
		setEnding(true);
		try {
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
					matchId: match.id,
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
		if (!confirm('Are you sure you want to abandon this match?')) return;
		try {
			await endMatch({
				data: {
					matchId: match.id,
					status: 'abandoned',
				},
			});
			await router.invalidate();
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Failed to abandon match');
		}
	};

	return (
		<Stack gap="xl">
			<Breadcrumbs>
				<Anchor component={Link} to="/matches">
					Matches
				</Anchor>
				<Text>Match #{match.id}</Text>
			</Breadcrumbs>

			<Paper shadow="sm" p="md" withBorder>
				<Stack gap="md">
					<Group justify="space-between">
						<Stack gap={0}>
							<Title order={2}>Match Details</Title>
							<Text size="sm" c="dimmed">
								{match.createdAt
									? new Date(match.createdAt).toLocaleString()
									: 'N/A'}
							</Text>
						</Stack>
						<Badge
							color={
								match.status === 'active'
									? 'blue'
									: match.status === 'finished'
										? 'green'
										: 'red'
							}
						>
							{match.status}
						</Badge>
					</Group>

					{match.status === 'active' && isParticipant && (
						<Group>
							<Button
								variant="outline"
								color="red"
								onClick={handleAbandonMatch}
							>
								Abandon
							</Button>
							<Button onClick={openEndMatch}>End Match</Button>
						</Group>
					)}

					<Group gap="xl" justify="center" wrap="wrap" mt="md">
						{match.matchPlayers?.map((mp, index) => (
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
								{match.winnerId === mp.playerId && (
									<Badge color="yellow" variant="filled">
										Winner
									</Badge>
								)}
							</Stack>
						))}
					</Group>
				</Stack>
			</Paper>

			{match.status === 'active' && isParticipant && (
				<Card withBorder shadow="sm" p="md">
					<Stack gap="md">
						<Title order={3}>
							{activeGame ? `Game #${activeGame.gameNumber}` : 'Start New Game'}
						</Title>

						{activeGame ? (
							<Stack gap="md">
								<Text>Who won this game?</Text>
								<Group>
									{activeGame.gamePlayers.map((gp) => (
										<Button
											key={gp.playerId}
											onClick={() => handleRecordWin(gp.playerId)}
											loading={recordingWin}
											variant={
												currentPlayer?.id === gp.playerId ? 'filled' : 'outline'
											}
											flex={1}
										>
											{gp.player.displayName}{' '}
											{currentPlayer?.id === gp.playerId ? '(You)' : ''} Won
										</Button>
									))}
								</Group>
							</Stack>
						) : (
							<Stack gap="md">
								<Group grow>
									<Select
										label="Player 1"
										placeholder="Select player"
										value={p1}
										onChange={setP1}
										data={match.matchPlayers?.map((mp) => ({
											value: mp.playerId,
											label: mp.player.displayName,
										}))}
									/>
									<Select
										label="Player 2"
										placeholder="Select player"
										value={p2}
										onChange={setP2}
										data={match.matchPlayers?.map((mp) => ({
											value: mp.playerId,
											label: mp.player.displayName,
										}))}
									/>
								</Group>
								<Button
									onClick={handleStartGame}
									loading={startingGame}
									disabled={!p1 || !p2 || p1 === p2}
								>
									Start Game
								</Button>
							</Stack>
						)}
					</Stack>
				</Card>
			)}

			{match.games && match.games.length > 0 && (
				<Paper withBorder p="md" shadow="sm">
					<Stack gap="md">
						<Title order={3}>Game History</Title>
						<Divider />
						<Stack gap="xs">
							{match.games
								.filter((g) => g.status === 'finished')
								.sort((a, b) => b.gameNumber - a.gameNumber)
								.map((game) => (
									<Group
										key={game.id}
										justify="space-between"
										p="xs"
										style={{
											borderBottom:
												'1px solid var(--mantine-color-default-border)',
										}}
									>
										<Text fw={500}>Game #{game.gameNumber}</Text>
										<Group gap="xs">
											<Text size="sm">Winner:</Text>
											<Badge color="green" variant="light">
												{game.gamePlayers.find(
													(gp) => gp.playerId === game.winnerId,
												)?.player.displayName || 'Unknown'}
											</Badge>
										</Group>
										<Text size="xs" c="dimmed">
											{game.finishedAt
												? new Date(game.finishedAt).toLocaleTimeString()
												: ''}
										</Text>
									</Group>
								))}
						</Stack>
					</Stack>
				</Paper>
			)}

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

					{match.matchPlayers?.map((mp) => (
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
