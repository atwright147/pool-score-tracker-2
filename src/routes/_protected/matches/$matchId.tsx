import {
	Anchor,
	Badge,
	Breadcrumbs,
	Button,
	Group,
	Modal,
	NumberInput,
	Paper,
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
		})
	})

const getCurrentPlayer = createServerFn({ method: 'GET' }).handler(async () => {
	const { auth } = await import('~/lib/auth');
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });

	if (!session?.user.id) return null;

	return await db.query.player.findFirst({
		where: (player, { eq }) => eq(player.userId, session.user.id),
	})
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
				.run()
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
				.run()

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
						.run()
				}
			}
		})

		return { success: true };
	})

export const Route = createFileRoute('/_protected/matches/$matchId')({
	component: MatchDetailsPage,
	loader: async ({ params }) => {
		const matchId = Number.parseInt(params.matchId, 10);
		if (Number.isNaN(matchId)) throw new Error('Invalid match ID');

		const [match, currentPlayer] = await Promise.all([
			getMatch({ data: matchId }),
			getCurrentPlayer(),
		])

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
	)
}

function MatchDetailsPage() {
	const { match, currentPlayer } = Route.useLoaderData();
	const router = useRouter();
	const [endMatchOpened, { open: openEndMatch, close: closeEndMatch }] =
		useDisclosure(false);
	const [matchScores, setMatchScores] = useState<Record<string, number>>({});
	const [ending, setEnding] = useState(false);

	// Initialize scores from match data if available
	useEffect(() => {
		if (match.matchPlayers) {
			const scores: Record<string, number> = {};
			for (const mp of match.matchPlayers) {
				scores[mp.playerId] = mp.score || 0;
			}
			setMatchScores(scores);
		}
	}, [match]);

	const handleConfirmEndMatch = async () => {
		setEnding(true);
		try {
			let winnerId: string | undefined;
			let maxScore = -1;
			const playerScores = Object.entries(matchScores).map(
				([playerId, score]) => {
					if (score > maxScore) {
						maxScore = score
						winnerId = playerId;
					}
					return { playerId, score };
				},
			)

			await endMatch({
				data: {
					matchId: match.id,
					winnerId,
					playerScores,
					status: 'finished',
				},
			})
			closeEndMatch();
			await router.invalidate();
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Failed to end match');
		} finally {
			setEnding(false);
		}
	}

	const handleAbandonMatch = async () => {
		if (!confirm('Are you sure you want to abandon this match?')) return;
		try {
			await endMatch({
				data: {
					matchId: match.id,
					status: 'abandoned',
				},
			})
			await router.invalidate();
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Failed to abandon match');
		}
	}

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

					{match.status === 'active' && (
						<Group>
							<Button
								variant='outline'
								color='red'
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
	)
}
