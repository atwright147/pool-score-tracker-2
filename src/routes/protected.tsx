import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/protected")({
	beforeLoad: async ({ request }) => {
		// Dynamic import to keep auth on server only
		const { auth } = await import("~/lib/auth");

		// Get session from request headers
		const session = await auth.api.getSession({
			headers: request?.headers || new Headers(),
		});

		if (!session) {
			throw redirect({
				to: "/auth",
				search: {
					redirect: "/protected",
				},
			});
		}

		return { session };
	},
	component: ProtectedPage,
});

function ProtectedPage() {
	const { session } = Route.useRouteContext();

	return (
		<div className="flex flex-col items-center justify-center min-h-screen gap-4">
			<h1 className="text-3xl font-bold">Protected Page</h1>
			<div className="p-6 bg-white rounded-lg shadow-md">
				<p className="text-lg">
					Welcome, <span className="font-semibold">{session.user.name}</span>!
				</p>
				<p className="mt-2 text-gray-600">
					This page is only accessible to authenticated users.
				</p>
				<p className="mt-1 text-sm text-gray-500">
					Email: {session.user.email}
				</p>
			</div>
		</div>
	);
}
