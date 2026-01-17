import { createAuthClient } from "better-auth/react";
import type { Session } from "~/lib/auth.types";

export const authClient = createAuthClient({
	// Use relative URL so it works in all environments (dev, preview, production)
	baseURL: typeof window !== "undefined" ? window.location.origin : "",
});

export const { signIn, signOut, signUp, useSession } = authClient;

export type { Session };
