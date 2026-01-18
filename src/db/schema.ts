import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Better Auth tables
export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull(),
	image: text('image'),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
	ipAddress: text('ipAddress'),
	userAgent: text('userAgent'),
	userId: text('userId')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
});

export const account = sqliteTable('account', {
	id: text('id').primaryKey(),
	accountId: text('accountId').notNull(),
	providerId: text('providerId').notNull(),
	userId: text('userId')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('accessToken'),
	refreshToken: text('refreshToken'),
	idToken: text('idToken'),
	accessTokenExpiresAt: integer('accessTokenExpiresAt', {
		mode: 'timestamp',
	}),
	refreshTokenExpiresAt: integer('refreshTokenExpiresAt', {
		mode: 'timestamp',
	}),
	scope: text('scope'),
	password: text('password'),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
});

export const verification = sqliteTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
	createdAt: integer('createdAt', { mode: 'timestamp' }),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }),
});

// Player profiles - extends auth user with pool-specific data
export const player = sqliteTable('player', {
	id: text('id').primaryKey(), // Same as user.id
	userId: text('user_id')
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: 'cascade' }),
	displayName: text('display_name').notNull(), // Can differ from auth name
	skillLevel: integer('skill_level'), // Optional: 1-10 rating
	gamesPlayed: integer('games_played').notNull().default(0),
	gamesWon: integer('games_won').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
		() => new Date(),
	),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
		() => new Date(),
	),
});

// Friendship relationships between players
export const friendship = sqliteTable('friendship', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	requesterId: text('requester_id')
		.notNull()
		.references(() => player.id, { onDelete: 'cascade' }),
	addresseeId: text('addressee_id')
		.notNull()
		.references(() => player.id, { onDelete: 'cascade' }),
	status: text('status')
		.$type<'pending' | 'accepted' | 'declined' | 'blocked'>()
		.notNull()
		.default('pending'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
		() => new Date(),
	),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
		() => new Date(),
	),
});

// Matches between players
export const matches = sqliteTable('matches', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	playerOneId: text('player_one_id')
		.notNull()
		.references(() => player.id),
	playerTwoId: text('player_two_id')
		.notNull()
		.references(() => player.id),
	winnerId: text('winner_id').references(() => player.id),
	playerOneScore: integer('player_one_score').default(0),
	playerTwoScore: integer('player_two_score').default(0),
	status: text('status')
		.$type<'active' | 'finished' | 'abandoned'>()
		.notNull()
		.default('active'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
		() => new Date(),
	),
	finishedAt: integer('finished_at', { mode: 'timestamp' }),
});
