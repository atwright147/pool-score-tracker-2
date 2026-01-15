import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: text("id").primaryKey(), // Better Auth usually uses string IDs
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
});

export const matches = sqliteTable("matches", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	playerOneId: text("player_one_id").references(() => users.id),
	playerTwoId: text("player_two_id").references(() => users.id),
	winnerId: text("winner_id").references(() => users.id),
	status: text("status").$type<"active" | "finished">().default("active"),
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
		() => new Date(),
	),
});
