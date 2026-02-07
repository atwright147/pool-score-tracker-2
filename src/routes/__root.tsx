import {
	AppShell,
	Container,
	MantineProvider,
	Text,
	Title,
} from '@mantine/core';
import type { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Scripts,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';

import Header from '~/components/Header';
import appCss from '~/styles.css?url';

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: 'utf-8',
			},
			{
				name: 'viewport',
				content: 'width=device-width, initial-scale=1',
			},
			{
				title: 'TanStack Start Starter',
			},
		],
		links: [
			{
				rel: 'stylesheet',
				href: appCss,
			},
		],
	}),

	shellComponent: RootDocument,

	notFoundComponent: () => {
		return (
			<Container size="sm" style={{ textAlign: 'center', paddingTop: '4rem' }}>
				<Title order={1} size="4rem" c="dimmed">
					404
				</Title>
				<Title order={2} mt="md">
					Page Not Found
				</Title>
				<Text c="dimmed" mt="md">
					The page you're looking for doesn't exist.
				</Text>
				<Link to="/" style={{ display: 'inline-block', marginTop: '2rem' }}>
					<Text c="blue" td="underline">
						Go back home
					</Text>
				</Link>
			</Container>
		);
	},
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<MantineProvider defaultColorScheme="dark">
					<AppShell header={{ height: 60 }} padding="md">
						<Header />
						<AppShell.Main>{children}</AppShell.Main>
					</AppShell>
					<TanStackRouterDevtools position="bottom-right" />
					<ReactQueryDevtools buttonPosition="bottom-left" />
				</MantineProvider>
				<Scripts />
			</body>
		</html>
	);
}
