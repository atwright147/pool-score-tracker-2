import {
	AppShell,
	Box,
	Burger,
	Drawer,
	Group,
	NavLink,
	Stack,
	Title,
} from '@mantine/core';
import { Link } from '@tanstack/react-router';
import {
	ChevronDown,
	ChevronRight,
	Home,
	Lock,
	Network,
	Shield,
	SquareFunction,
	StickyNote,
} from 'lucide-react';
import { useState } from 'react';

export default function Header() {
	const [isOpen, setIsOpen] = useState(false);
	const [groupedExpanded, setGroupedExpanded] = useState<
		Record<string, boolean>
	>({});

	return (
		<>
			<AppShell.Header p="md">
				<Group>
					<Burger opened={isOpen} onClick={() => setIsOpen(true)} />
					<Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
						<img
							src="/tanstack-word-logo-white.svg"
							alt="TanStack Logo"
							style={{ height: 40 }}
						/>
					</Link>
				</Group>
			</AppShell.Header>

			<Drawer
				opened={isOpen}
				onClose={() => setIsOpen(false)}
				title={<Title order={3}>Navigation</Title>}
				size="sm"
			>
				<Stack gap="xs">
					<NavLink
						component={Link}
						to="/"
						label="Home"
						leftSection={<Home size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					<NavLink
						component={Link}
						to="/auth"
						label="Authentication"
						leftSection={<Lock size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					<NavLink
						component={Link}
						to="/logout"
						label="Logout"
						leftSection={<Lock size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					<NavLink
						component={Link}
						to="/friends"
						label="Friends"
						leftSection={<Shield size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					<NavLink
						component={Link}
						to="/protected"
						label="Protected Page"
						leftSection={<Shield size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					<NavLink
						component={Link}
						to="/demo/start/server-funcs"
						label="Start - Server Functions"
						leftSection={<SquareFunction size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					<NavLink
						component={Link}
						to="/demo/start/api-request"
						label="Start - API Request"
						leftSection={<Network size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					<NavLink
						component={Link}
						to="/demo/start/ssr"
						label="Start - SSR Demos"
						leftSection={<StickyNote size={20} />}
						rightSection={
							groupedExpanded.StartSSRDemo ? (
								<ChevronDown size={16} />
							) : (
								<ChevronRight size={16} />
							)
						}
						onClick={(e) => {
							e.preventDefault();
							setGroupedExpanded((prev) => ({
								...prev,
								StartSSRDemo: !prev.StartSSRDemo,
							}));
						}}
					/>

					{groupedExpanded.StartSSRDemo && (
						<Box pl="md">
							<Stack gap="xs">
								<NavLink
									component={Link}
									to="/demo/start/ssr/spa-mode"
									label="SPA Mode"
									leftSection={<StickyNote size={16} />}
									onClick={() => setIsOpen(false)}
								/>

								<NavLink
									component={Link}
									to="/demo/start/ssr/full-ssr"
									label="Full SSR"
									leftSection={<StickyNote size={16} />}
									onClick={() => setIsOpen(false)}
								/>

								<NavLink
									component={Link}
									to="/demo/start/ssr/data-only"
									label="Data Only"
									leftSection={<StickyNote size={16} />}
									onClick={() => setIsOpen(false)}
								/>
							</Stack>
						</Box>
					)}

					<NavLink
						component={Link}
						to="/demo/tanstack-query"
						label="TanStack Query"
						leftSection={<Network size={20} />}
						onClick={() => setIsOpen(false)}
					/>
				</Stack>
			</Drawer>
		</>
	);
}
