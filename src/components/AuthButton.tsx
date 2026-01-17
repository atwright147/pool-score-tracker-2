import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { signOut, useSession } from "~/lib/auth-client";

export function AuthButton() {
	const { data: session, isPending } = useSession();
	const [isSigningOut, setIsSigningOut] = useState(false);

	const handleSignOut = async () => {
		setIsSigningOut(true);
		try {
			await signOut();
		} catch (error) {
			console.error("Sign out failed:", error);
		} finally {
			setIsSigningOut(false);
		}
	};

	if (isPending) {
		return <div className="text-sm">Loading...</div>;
	}

	if (session) {
		return (
			<div className="flex items-center gap-4">
				<span className="text-sm">
					{session.user.name} ({session.user.email})
				</span>
				<button
					type="button"
					onClick={handleSignOut}
					disabled={isSigningOut}
					className="px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
				>
					{isSigningOut ? "Signing out..." : "Sign Out"}
				</button>
			</div>
		);
	}

	return (
		<Link
			to="/auth"
			className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
		>
			Sign In
		</Link>
	);
}
