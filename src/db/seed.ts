import { faker } from '@faker-js/faker';
import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { db } from './db';
import * as schema from './schema';

async function main() {
	console.log('🌱 Seeding database...');

	// Clear existing data (in reverse order of dependencies)
	await db.delete(schema.gamePlayers);
	await db.delete(schema.games);
	await db.delete(schema.matchPlayers);
	await db.delete(schema.matches);
	await db.delete(schema.friendship);
	await db.delete(schema.player);
	await db.delete(schema.session);
	await db.delete(schema.account);
	await db.delete(schema.verification);
	await db.delete(schema.user);

	console.log('✓ Cleared existing data');

	// Create users
	const users = [];
	const players = [];
	const now = new Date();

	// Add Andy Wright as the first user (for testing/dev)
	const andyUserId = faker.string.uuid();
	const andyPlayerId = faker.string.uuid();
	users.push({
		id: andyUserId,
		name: 'Andy Wright',
		email: 'andy@example.com',
		emailVerified: true,
		image: faker.image.avatar(),
		createdAt: faker.date.past({ years: 2 }),
		updatedAt: now,
	});

	players.push({
		id: andyPlayerId,
		userId: andyUserId,
		displayName: 'Andy Wright',
		skillLevel: 8,
		gamesPlayed: 42,
		gamesWon: 25,
		createdAt: faker.date.past({ years: 2 }),
		updatedAt: now,
	});

	// Create additional random users
	for (let i = 0; i < 10; i++) {
		const userId = faker.string.uuid();
		const firstName = faker.person.firstName();
		const lastName = faker.person.lastName();
		const email = faker.internet
			.email({ firstName, lastName, provider: 'example.com' })
			.toLowerCase();

		users.push({
			id: userId,
			name: `${firstName} ${lastName}`,
			email,
			emailVerified: faker.datatype.boolean(),
			image: faker.image.avatar(),
			createdAt: faker.date.past({ years: 2 }),
			updatedAt: now,
		});

		players.push({
			id: faker.string.uuid(),
			userId,
			displayName: faker.helpers.arrayElement([
				`${firstName} ${lastName}`,
				firstName,
				faker.internet.username({ firstName, lastName }),
			]),
			skillLevel: faker.number.int({ min: 1, max: 10 }),
			gamesPlayed: faker.number.int({ min: 0, max: 100 }),
			gamesWon: faker.number.int({ min: 0, max: 50 }),
			createdAt: faker.date.past({ years: 2 }),
			updatedAt: now,
		});
	}

	await db.insert(schema.user).values(users);
	console.log(`✓ Created ${users.length} users`);
	console.log('  → Test account: andy@example.com / password');

	// Create account records for email/password authentication
	const hashedPassword = await hashPassword('password');
	const accounts = users.map((user) => ({
		id: faker.string.uuid(),
		accountId: user.email,
		providerId: 'credential',
		userId: user.id,
		password: hashedPassword,
		accessToken: null,
		refreshToken: null,
		idToken: null,
		accessTokenExpiresAt: null,
		refreshTokenExpiresAt: null,
		scope: null,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	}));

	await db.insert(schema.account).values(accounts);
	console.log(
		`✓ Created ${accounts.length} accounts with password: "password"`,
	);

	await db.insert(schema.player).values(players);
	console.log(`✓ Created ${players.length} players`);

	// Create friendships
	const friendships = [];

	// Andy's specific test friendships (Andy is at index 0)
	const andyPlayer = players[0];

	// Andy sends friend requests (requester)
	friendships.push({
		requesterId: andyPlayer.id,
		addresseeId: players[1].id, // accepted
		status: 'accepted' as const,
		createdAt: faker.date.past({ years: 1 }),
		updatedAt: now,
	});

	friendships.push({
		requesterId: andyPlayer.id,
		addresseeId: players[2].id, // pending
		status: 'pending' as const,
		createdAt: faker.date.past({ years: 1 }),
		updatedAt: now,
	});

	friendships.push({
		requesterId: andyPlayer.id,
		addresseeId: players[3].id, // declined
		status: 'declined' as const,
		createdAt: faker.date.past({ years: 1 }),
		updatedAt: now,
	});

	// Andy receives friend requests (addressee)
	friendships.push({
		requesterId: players[4].id, // accepted
		addresseeId: andyPlayer.id,
		status: 'accepted' as const,
		createdAt: faker.date.past({ years: 1 }),
		updatedAt: now,
	});

	friendships.push({
		requesterId: players[5].id, // pending
		addresseeId: andyPlayer.id,
		status: 'pending' as const,
		createdAt: faker.date.past({ years: 1 }),
		updatedAt: now,
	});

	friendships.push({
		requesterId: players[6].id, // declined
		addresseeId: andyPlayer.id,
		status: 'declined' as const,
		createdAt: faker.date.past({ years: 1 }),
		updatedAt: now,
	});

	// Track existing friendship pairs to avoid duplicates
	const existingPairs = new Set<string>();
	friendships.forEach((f) => {
		// Create a unique key for each pair (order-independent)
		const key = [f.requesterId, f.addresseeId].sort().join('-');
		existingPairs.add(key);
	});

	// Create additional random friendships (avoid duplicates)
	let attempts = 0;
	while (friendships.length < 21 && attempts < 100) {
		attempts++;
		const requester = faker.helpers.arrayElement(players);
		const addressee = faker.helpers.arrayElement(
			players.filter((p) => p.id !== requester.id),
		);

		// Check if this pair already has a friendship
		const pairKey = [requester.id, addressee.id].sort().join('-');
		if (existingPairs.has(pairKey)) {
			continue; // Skip this pair, try another
		}

		existingPairs.add(pairKey);
		friendships.push({
			requesterId: requester.id,
			addresseeId: addressee.id,
			status: faker.helpers.arrayElement([
				'pending',
				'accepted',
				'accepted',
				'accepted',
				'declined',
			] as const),
			createdAt: faker.date.past({ years: 1 }),
			updatedAt: now,
		});
	}

	await db.insert(schema.friendship).values(friendships);
	console.log(`✓ Created ${friendships.length} friendships`);
	console.log(
		'  → Andy has 3 sent (accepted/pending/declined) and 3 received (accepted/pending/declined) friend requests',
	);

	// Create matches
	const playersWithActiveMatch = new Set<string>();

	for (let i = 0; i < 20; i++) {
		const playerCount = faker.number.int({ min: 2, max: 8 });
		let selectedPlayers = faker.helpers.arrayElements(players, playerCount);

		const isFinished = faker.datatype.boolean({ probability: 0.8 });
		let status: 'active' | 'finished' | 'abandoned' = 'finished';

		if (isFinished) {
			status = faker.helpers.arrayElement(['finished', 'abandoned']);
		} else {
			// Only allow players who are not currently in an active match to start a new active one
			const availablePlayers = selectedPlayers.filter(
				(p) => !playersWithActiveMatch.has(p.id),
			);

			if (availablePlayers.length >= 2) {
				status = 'active';
				selectedPlayers = availablePlayers;
				for (const p of selectedPlayers) {
					playersWithActiveMatch.add(p.id);
				}
			} else {
				// Fallback to finished if we couldn't find enough free players for an active match
				status = 'finished';
			}
		}

		const [match] = await db
			.insert(schema.matches)
			.values({
				status,
				createdAt: faker.date.past({ years: 1 }),
				finishedAt:
					status === 'finished' ? faker.date.recent({ days: 30 }) : null,
			})
			.returning();

		const matchPlayersData = [];
		let maxMatchScore = -1;
		let matchWinnerId = null;

		for (const p of selectedPlayers) {
			const score =
				status === 'finished' ? faker.number.int({ min: 0, max: 10 }) : 0;
			if (score > maxMatchScore) {
				maxMatchScore = score;
				matchWinnerId = p.id;
			}
			matchPlayersData.push({
				matchId: match.id,
				playerId: p.id,
				score,
			});
		}

		await db.insert(schema.matchPlayers).values(matchPlayersData);
		if (status === 'finished' && matchWinnerId) {
			await db
				.update(schema.matches)
				.set({ winnerId: matchWinnerId })
				.where(eq(schema.matches.id, match.id));
		}

		// Create some games for this match
		if (status !== 'abandoned') {
			const gameCount = faker.number.int({ min: 1, max: 5 });
			for (let g = 0; g < gameCount; g++) {
				const gameFinished = status === 'finished' || faker.datatype.boolean();
				const [game] = await db
					.insert(schema.games)
					.values({
						matchId: match.id,
						gameNumber: g + 1,
						status: gameFinished ? 'finished' : 'active',
						createdAt: match.createdAt,
					})
					.returning();

				const gamePlayersData = [];
				let maxGameScore = -1;
				let gameWinnerId = null;

				for (const p of selectedPlayers) {
					const score = gameFinished
						? faker.number.int({ min: 0, max: 15 })
						: 0;
					if (score > maxGameScore) {
						maxGameScore = score;
						gameWinnerId = p.id;
					}
					gamePlayersData.push({
						gameId: game.id,
						playerId: p.id,
						score,
					});
				}

				await db.insert(schema.gamePlayers).values(gamePlayersData);
				if (gameFinished && gameWinnerId) {
					await db
						.update(schema.games)
						.set({ winnerId: gameWinnerId })
						.where(eq(schema.games.id, game.id));
				}
			}
		}
	}

	console.log('✓ Created 20 matches with varying player counts');

	console.log('✅ Seeding complete!');
}

main().catch((error) => {
	console.error('❌ Seeding failed:', error);
	process.exit(1);
});
