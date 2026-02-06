import { faker } from '@faker-js/faker';
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

	await db.insert(schema.player).values(players);
	console.log(`✓ Created ${players.length} players`);

	// Create friendships
	const friendships = [];
	for (let i = 0; i < 15; i++) {
		const requester = faker.helpers.arrayElement(players);
		const addressee = faker.helpers.arrayElement(
			players.filter((p) => p.id !== requester.id),
		);

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
