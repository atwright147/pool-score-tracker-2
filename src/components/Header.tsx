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
import {
	IconChevronDown,
	IconChevronRight,
	IconFunction,
	IconHome,
	IconLock,
	IconNetwork,
	IconNote,
	IconShield,
} from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
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
						<img src="/logo.svg" alt="CueConnect Logo" style={{ height: 25 }} />
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
						leftSection={<IconHome size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					<NavLink
						component={Link}
						to="/auth"
						label="Authentication"
						leftSection={<IconLock size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					<NavLink
						component={Link}
						to="/logout"
						label="Logout"
						leftSection={<IconLock size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					<NavLink
						component={Link}
						to="/friends"
						label="Friends"
						leftSection={<IconShield size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					<NavLink
						component={Link}
						to="/protected"
						label="Protected Page"
						leftSection={<IconShield size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					<NavLink
						component={Link}
						to="/demo/start/server-funcs"
						label="Start - Server Functions"
						leftSection={<IconFunction size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					<NavLink
						component={Link}
						to="/demo/start/api-request"
						label="Start - API Request"
						leftSection={<IconNetwork size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					<NavLink
						component={Link}
						to="/demo/start/ssr"
						label="Start - SSR Demos"
						leftSection={<IconNote size={20} />}
						rightSection={
							groupedExpanded.StartSSRDemo ? (
								<IconChevronDown size={16} />
							) : (
								<IconChevronRight size={16} />
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
									leftSection={<IconNote size={16} />}
									onClick={() => setIsOpen(false)}
								/>

								<NavLink
									component={Link}
									to="/demo/start/ssr/full-ssr"
									label="Full SSR"
									leftSection={<IconNote size={16} />}
									onClick={() => setIsOpen(false)}
								/>

								<NavLink
									component={Link}
									to="/demo/start/ssr/data-only"
									label="Data Only"
									leftSection={<IconNote size={16} />}
									onClick={() => setIsOpen(false)}
								/>
							</Stack>
						</Box>
					)}

					<NavLink
						component={Link}
						to="/demo/tanstack-query"
						label="TanStack Query"
						leftSection={<IconNetwork size={20} />}
						onClick={() => setIsOpen(false)}
					/>
				</Stack>
			</Drawer>
		</>
	);
}
