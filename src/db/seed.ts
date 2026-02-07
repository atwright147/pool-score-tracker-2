import { faker } from '@faker-js/faker';
import { hashPassword } from 'better-auth/crypto';
import { db } from './db';
import * as schema from './schema';

async function main() {
	console.log('🌱 Seeding database...');

	// Clear existing data (in reverse order of dependencies)
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
	const matches = [];
	for (let i = 0; i < 20; i++) {
		const playerOne = faker.helpers.arrayElement(players);
		const playerTwo = faker.helpers.arrayElement(
			players.filter((p) => p.id !== playerOne.id),
		);

		const isFinished = faker.datatype.boolean({ probability: 0.7 });
		const playerOneScore = isFinished
			? faker.number.int({ min: 0, max: 15 })
			: faker.number.int({ min: 0, max: 5 });
		const playerTwoScore = isFinished
			? faker.number.int({ min: 0, max: 15 })
			: faker.number.int({ min: 0, max: 5 });

		let winnerId = null;
		let status: 'active' | 'finished' | 'abandoned' = 'active';

		if (isFinished) {
			status = 'finished';
			winnerId = playerOneScore > playerTwoScore ? playerOne.id : playerTwo.id;
		}

		matches.push({
			playerOneId: playerOne.id,
			playerTwoId: playerTwo.id,
			winnerId,
			playerOneScore,
			playerTwoScore,
			status,
			createdAt: faker.date.past({ years: 1 }),
			finishedAt: isFinished ? faker.date.recent({ days: 30 }) : null,
		});
	}

	await db.insert(schema.matches).values(matches);
	console.log(`✓ Created ${matches.length} matches`);

	console.log('✅ Seeding complete!');
}

main().catch((error) => {
	console.error('❌ Seeding failed:', error);
	process.exit(1);
});
