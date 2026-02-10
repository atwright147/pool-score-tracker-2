import { AppShell, Burger, Drawer, Group, NavLink, Stack } from '@mantine/core';
import {
	IconChessKnight,
	IconFriends,
	IconGraph,
	IconHome,
	IconLock,
	IconLogout2,
} from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { useSession } from '~/lib/auth-client';

export default function Header() {
	const [isOpen, setIsOpen] = useState(false);
	const { data: session } = useSession();

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
				title="Navigation"
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
						to="/matches"
						label="Matches"
						leftSection={<IconChessKnight size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					<NavLink
						component={Link}
						to="/insights"
						label="Insights"
						leftSection={<IconGraph size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					<NavLink
						component={Link}
						to="/friends"
						label="Friends"
						leftSection={<IconFriends size={20} />}
						onClick={() => setIsOpen(false)}
					/>

					{!session && (
						<NavLink
							component={Link}
							to="/auth"
							label="Authentication"
							leftSection={<IconLock size={20} />}
							onClick={() => setIsOpen(false)}
						/>
					)}

					{session && (
						<NavLink
							component={Link}
							to="/logout"
							label="Logout"
							leftSection={<IconLogout2 size={20} />}
							onClick={() => setIsOpen(false)}
						/>
					)}
				</Stack>
			</Drawer>
		</>
	);
}
