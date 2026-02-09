import { Badge, Group, Paper, Stack, Table, Text, Title } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { db } from '~/db/db';
import { friendship, matches } from '~/db/schema';

// Server function to get detailed match history
const getMatchHistory = createServerFn({ method: 'GET' }).handler(async () => {
	const { auth } = await import('~/lib/auth');
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });

	if (!session?.user.id) return [];

	const playerProfile = await db.query.player.findFirst({
		where: (player, { eq }) => eq(player.userId, session.user.id),
	});

	if (!playerProfile) return [];

	const matchHistory = await db.query.matches.findMany({
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

	return matchHistory.map((match) => ({
		id: match.id,
		date: match.createdAt,
		won: match.winnerId === playerProfile.id,
		gamesCount: match.games?.length || 0,
		opponents: match.matchPlayers
			?.filter((mp) => mp.playerId !== playerProfile.id)
			?.map((mp) => mp.player.displayName)
			?.join(', '),
	}));
});

// Server function to get friend stats for head-to-head
const getFriendStats = createServerFn({ method: 'GET' }).handler(async () => {
	const { auth } = await import('~/lib/auth');
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });

	if (!session?.user.id) return [];

	const playerProfile = await db.query.player.findFirst({
		where: (player, { eq }) => eq(player.userId, session.user.id),
	});

	if (!playerProfile) return [];

	// Get accepted friends
	const friends = await db.query.friendship.findMany({
		where: and(
			sql`(requester_id = ${playerProfile.id} OR addressee_id = ${playerProfile.id})`,
			eq(friendship.status, 'accepted'),
		),
		with: {
			requester: true,
			addressee: true,
		},
	});

	return friends.map((f) =>
		f.requesterId === playerProfile.id ? f.addressee : f.requester,
	);
});

// Server function to get year's activity for heatmap
const getYearActivity = createServerFn({ method: 'GET' }).handler(async () => {
	const { auth } = await import('~/lib/auth');
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });

	if (!session?.user.id) return {};

	const playerProfile = await db.query.player.findFirst({
		where: (player, { eq }) => eq(player.userId, session.user.id),
	});

	if (!playerProfile) return {};

	const oneYearAgo = new Date();
	oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

	// Get all matches for this player (finished or abandoned)
	const allMatches = await db.query.matches.findMany({
		where: and(
			ne(matches.status, 'active'),
			sql`EXISTS (SELECT 1 FROM match_players WHERE match_id = ${matches.id} AND player_id = ${playerProfile.id})`,
		),
		with: {
			games: true,
		},
		orderBy: desc(matches.createdAt),
	});

	// Group by date
	const activityMap: Record<string, number> = {};
	allMatches.forEach((match) => {
		const date = new Date(match.createdAt);
		// Format as YYYY-MM-DD
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const dateStr = `${year}-${month}-${day}`;
		activityMap[dateStr] =
			(activityMap[dateStr] || 0) + (match.games?.length || 0);
	});

	return activityMap;
});

export const Route = createFileRoute('/_protected/insights')({
	component: InsightsPage,
	loader: async () => {
		const [matchHistory, friends, yearActivity] = await Promise.all([
			getMatchHistory(),
			getFriendStats(),
			getYearActivity(),
		]);
		return { matchHistory, friends, yearActivity };
	},
});

function InsightsPage() {
	const { session } = Route.useRouteContext();
	const { matchHistory, friends, yearActivity } = Route.useLoaderData();

	// Calculate stats
	const totalMatches = matchHistory.length;
	const wins = matchHistory.filter((m) => m.won).length;
	const losses = totalMatches - wins;
	const winRate =
		totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

	// Recent form (last 10 matches)
	const recentForm = matchHistory
		.slice(0, 10)
		.reverse()
		.map((match, idx) => ({
			name: `Match ${idx + 1}`,
			result: match.won ? 1 : 0,
			label: match.won ? 'Won' : 'Lost',
		}));

	// Win/Loss distribution
	const winDistribution = [
		{ name: 'Wins', value: wins, color: '#51cf66' },
		{ name: 'Losses', value: losses, color: '#868e96' },
	];

	// Games over time (last 30 days, grouped by week)
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const gamesByDate = matchHistory
		.filter((m) => new Date(m.date) >= thirtyDaysAgo)
		.reverse()
		.map((m, idx) => ({
			name: `Day ${idx + 1}`,
			games: m.gamesCount,
			date: new Date(m.date).toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
			}),
		}));

	// Win rate trend (last 20 matches)
	const last20 = matchHistory.slice(0, 20).reverse();
	const winRateTrend = last20.map((match, idx) => {
		const winsUpToNow = last20.slice(0, idx + 1).filter((m) => m.won).length;
		const rate =
			idx > 0
				? Math.round((winsUpToNow / (idx + 1)) * 100)
				: match.won
					? 100
					: 0;
		return {
			name: `Match ${idx + 1}`,
			winRate: rate,
		};
	});

	const _COLORS = ['#51cf66', '#868e96', '#ff6b6b', '#4c6ef5', '#ffd43b'];

	return (
		<Stack gap="xl">
			<div>
				<Title order={1}>Insights & Statistics</Title>
				<Text c="dimmed" mt="xs">
					Detailed analysis of your pool performance
				</Text>
			</div>

			{/* Summary Stats */}
			<Group grow>
				<Paper shadow="sm" p="md" radius="md" withBorder>
					<Text size="sm" fw={500} c="dimmed" mb="md">
						Total Matches
					</Text>
					<Text size="2xl" fw={700}>
						{totalMatches}
					</Text>
				</Paper>

				<Paper shadow="sm" p="md" radius="md" withBorder>
					<Text size="sm" fw={500} c="dimmed" mb="md">
						Total Wins
					</Text>
					<Text size="2xl" fw={700} c="green">
						{wins}
					</Text>
				</Paper>

				<Paper shadow="sm" p="md" radius="md" withBorder>
					<Text size="sm" fw={500} c="dimmed" mb="md">
						Total Losses
					</Text>
					<Text size="2xl" fw={700} c="gray">
						{losses}
					</Text>
				</Paper>

				<Paper shadow="sm" p="md" radius="md" withBorder>
					<Text size="sm" fw={500} c="dimmed" mb="md">
						Win Rate
					</Text>
					<Text size="2xl" fw={700} c="blue">
						{winRate}%
					</Text>
				</Paper>
			</Group>

			{/* Activity Heatmap - GitHub style */}
			<Paper shadow="sm" p="md" radius="md" withBorder>
				<Title order={3} mb="md">
					Games Played Throughout the Year
				</Title>
				<ActivityHeatmap yearActivity={yearActivity} />
			</Paper>

			{/* Charts */}
			<Group grow>
				{/* Recent Form */}
				<Paper shadow="sm" p="md" radius="md" withBorder>
					<Title order={3} mb="md">
						Recent Form (Last 10 Matches)
					</Title>
					{recentForm.length === 0 ? (
						<Text c="dimmed" ta="center" py="lg">
							No match data available
						</Text>
					) : (
						<ResponsiveContainer width="100%" height={250}>
							<BarChart data={recentForm}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="name" />
								<YAxis domain={[0, 1]} />
								<Tooltip
									content={({ active, payload }) => {
										if (active && payload?.[0]) {
											return (
												<div
													style={{
														backgroundColor: '#fff',
														padding: '8px',
														border: '1px solid #ccc',
														borderRadius: '4px',
													}}
												>
													<p style={{ margin: 0 }}>
														{payload[0].payload.label}
													</p>
												</div>
											);
										}
										return null;
									}}
								/>
								<Bar dataKey="result" fill="#4c6ef5">
									{recentForm.map((entry, index) => (
										<Cell
											key={`cell-${index}`}
											fill={entry.result === 1 ? '#51cf66' : '#868e96'}
										/>
									))}
								</Bar>
							</BarChart>
						</ResponsiveContainer>
					)}
				</Paper>

				{/* Win/Loss Distribution */}
				<Paper shadow="sm" p="md" radius="md" withBorder>
					<Title order={3} mb="md">
						Win/Loss Distribution
					</Title>
					{totalMatches === 0 ? (
						<Text c="dimmed" ta="center" py="lg">
							No match data available
						</Text>
					) : (
						<ResponsiveContainer width="100%" height={250}>
							<PieChart>
								<Pie
									data={winDistribution}
									cx="50%"
									cy="50%"
									labelLine={false}
									label={({ name, value }) => `${name}: ${value}`}
									outerRadius={80}
									fill="#8884d8"
									dataKey="value"
								>
									{winDistribution.map((entry, index) => (
										<Cell key={`cell-${index}`} fill={entry.color} />
									))}
								</Pie>
								<Tooltip />
							</PieChart>
						</ResponsiveContainer>
					)}
				</Paper>
			</Group>

			{/* Line Charts */}
			<Group grow>
				{/* Win Rate Trend */}
				<Paper shadow="sm" p="md" radius="md" withBorder>
					<Title order={3} mb="md">
						Win Rate Trend (Last 20 Matches)
					</Title>
					{winRateTrend.length === 0 ? (
						<Text c="dimmed" ta="center" py="lg">
							No match data available
						</Text>
					) : (
						<ResponsiveContainer width="100%" height={250}>
							<LineChart data={winRateTrend}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="name" />
								<YAxis domain={[0, 100]} />
								<Tooltip />
								<Legend />
								<Line
									type="monotone"
									dataKey="winRate"
									stroke="#51cf66"
									strokeWidth={2}
									name="Win Rate (%)"
								/>
							</LineChart>
						</ResponsiveContainer>
					)}
				</Paper>

				{/* Games Over Time */}
				<Paper shadow="sm" p="md" radius="md" withBorder>
					<Title order={3} mb="md">
						Games Over Time (Last 30 Days)
					</Title>
					{gamesByDate.length === 0 ? (
						<Text c="dimmed" ta="center" py="lg">
							No match data available
						</Text>
					) : (
						<ResponsiveContainer width="100%" height={250}>
							<LineChart data={gamesByDate}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="date" />
								<YAxis />
								<Tooltip />
								<Legend />
								<Line
									type="monotone"
									dataKey="games"
									stroke="#4c6ef5"
									strokeWidth={2}
									name="Games Played"
								/>
							</LineChart>
						</ResponsiveContainer>
					)}
				</Paper>
			</Group>

			{/* Head-to-Head vs Friends */}
			<Paper shadow="sm" p="md" radius="md" withBorder>
				<Title order={3} mb="md">
					Friend Statistics
				</Title>
				{friends.length === 0 ? (
					<Text c="dimmed" ta="center" py="lg">
						No friends yet
					</Text>
				) : (
					<Table.ScrollContainer minWidth={500}>
						<Table striped highlightOnHover>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Friend</Table.Th>
									<Table.Th>Games Played</Table.Th>
									<Table.Th>Games Won</Table.Th>
									<Table.Th>Win Rate</Table.Th>
									<Table.Th>Skill Level</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{friends
									.sort((a, b) => b.gamesPlayed - a.gamesPlayed)
									.map((friend) => (
										<Table.Tr key={friend.id}>
											<Table.Td>
												<Text fw={500}>{friend.displayName}</Text>
											</Table.Td>
											<Table.Td>{friend.gamesPlayed}</Table.Td>
											<Table.Td>
												<Badge color="green" variant="light">
													{friend.gamesWon}
												</Badge>
											</Table.Td>
											<Table.Td>
												{friend.gamesPlayed > 0
													? Math.round(
															(friend.gamesWon / friend.gamesPlayed) * 100,
														)
													: 0}
												%
											</Table.Td>
											<Table.Td>
												{friend.skillLevel ? (
													<Badge color="blue" variant="light">
														{friend.skillLevel}
													</Badge>
												) : (
													<Text c="dimmed" size="sm">
														—
													</Text>
												)}
											</Table.Td>
										</Table.Tr>
									))}
							</Table.Tbody>
						</Table>
					</Table.ScrollContainer>
				)}
			</Paper>

			{/* Match History */}
			<Paper shadow="sm" p="md" radius="md" withBorder>
				<Title order={3} mb="md">
					Match History (Last 20)
				</Title>
				{matchHistory.length === 0 ? (
					<Text c="dimmed" ta="center" py="lg">
						No matches yet
					</Text>
				) : (
					<Table.ScrollContainer minWidth={500}>
						<Table striped highlightOnHover>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Match ID</Table.Th>
									<Table.Th>Date</Table.Th>
									<Table.Th>Result</Table.Th>
									<Table.Th>Games</Table.Th>
									<Table.Th>Opponents</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{matchHistory.slice(0, 20).map((match) => (
									<Table.Tr key={match.id}>
										<Table.Td>
											<Text fw={500}>#{match.id}</Text>
										</Table.Td>
										<Table.Td>
											<Text size="sm">
												{new Date(match.date || '').toLocaleDateString(
													'en-US',
													{
														month: 'short',
														day: 'numeric',
														year: 'numeric',
													},
												)}
											</Text>
										</Table.Td>
										<Table.Td>
											<Badge
												color={match.won ? 'green' : 'gray'}
												variant="light"
											>
												{match.won ? 'Won' : 'Lost'}
											</Badge>
										</Table.Td>
										<Table.Td>{match.gamesCount}</Table.Td>
										<Table.Td>
											<Text size="sm" c="dimmed">
												{match.opponents}
											</Text>
										</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
					</Table.ScrollContainer>
				)}
			</Paper>
		</Stack>
	);
}

interface ActivityHeatmapProps {
	yearActivity: Record<string, number>;
}

function ActivityHeatmap({ yearActivity }: ActivityHeatmapProps) {
	// Generate all weeks of the year
	const today = new Date();
	const startOfYear = new Date(today.getFullYear(), 0, 1);
	const weeksInYear: Array<
		Array<{ date: string; games: number; dayName: string }>
	> = [];
	const activityValues = Object.values(yearActivity);
	const maxGames = activityValues.length > 0 ? Math.max(...activityValues) : 0;

	// Generate grid: weeks as columns, days as rows
	let currentDate = new Date(startOfYear);
	while (
		currentDate.getFullYear() === today.getFullYear() &&
		currentDate <= today
	) {
		const weekStart = new Date(currentDate);
		const weekDays = [];

		for (let i = 0; i < 7; i++) {
			// Format as YYYY-MM-DD to match activityMap keys
			const year = weekStart.getFullYear();
			const month = String(weekStart.getMonth() + 1).padStart(2, '0');
			const day = String(weekStart.getDate()).padStart(2, '0');
			const dateStr = `${year}-${month}-${day}`;
			const games = yearActivity[dateStr] || 0;
			weekDays.push({
				date: dateStr,
				games,
				dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
					weekStart.getDay()
				],
			});
			weekStart.setDate(weekStart.getDate() + 1);

			// Stop if we've gone past today
			if (weekStart > today) break;
		}

		if (weekDays.length > 0) {
			weeksInYear.push(weekDays);
		}
		currentDate = new Date(weekStart);
	}

	// Get color based on intensity
	const getColor = (games: number): string => {
		if (games === 0) return '#2c2e31';
		if (maxGames === 0) return '#2c2e31';

		const intensity = games / maxGames;

		// Color gradient from light green to dark green
		if (intensity < 0.2) return '#c6e48b';
		if (intensity < 0.4) return '#7bc96f';
		if (intensity < 0.7) return '#239a3b';
		return '#0d3929';
	};

	return (
		<div
			style={{
				overflowX: 'auto',
				padding: '16px 0',
			}}
		>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: `repeat(${weeksInYear.length}, 12px)`,
					gap: '4px',
					minWidth: '100%',
				}}
			>
				{weeksInYear.map((week, weekIdx) =>
					week.map((day, dayIdx) => (
						<div
							key={`${weekIdx}-${dayIdx}`}
							title={`${day.date}: ${day.games} game${day.games !== 1 ? 's' : ''}`}
							style={{
								width: '12px',
								height: '12px',
								backgroundColor: getColor(day.games),
								borderRadius: '2px',
								cursor: 'pointer',
								transition: 'transform 0.2s',
							}}
							onMouseEnter={(e) => {
								(e.target as HTMLElement).style.transform = 'scale(1.3)';
							}}
							onMouseLeave={(e) => {
								(e.target as HTMLElement).style.transform = 'scale(1)';
							}}
						/>
					)),
				)}
			</div>
			<Group gap="lg" mt="md">
				<Group gap={4}>
					<Text size="xs" c="dimmed">
						Less
					</Text>
					{[
						0,
						Math.ceil(maxGames / 4),
						Math.ceil(maxGames / 2),
						Math.ceil((3 * maxGames) / 4),
						maxGames,
					].map((i) => (
						<div
							key={i}
							style={{
								width: '12px',
								height: '12px',
								backgroundColor: getColor(i),
								borderRadius: '2px',
							}}
						/>
					))}
					<Text size="xs" c="dimmed">
						More
					</Text>
				</Group>
			</Group>
		</div>
	);
}
