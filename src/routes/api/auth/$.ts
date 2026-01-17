import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				try {
					return await auth.handler(request);
				} catch (error) {
					console.error("Auth GET error:", error);
					return new Response("Internal Server Error", { status: 500 });
				}
			},
			POST: async ({ request }) => {
				try {
					return await auth.handler(request);
				} catch (error) {
					console.error("Auth POST error:", error);
					return new Response("Internal Server Error", { status: 500 });
				}
			},
		},
	},
});
