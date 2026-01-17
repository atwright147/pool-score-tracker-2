import { Button, Group, Text } from "@mantine/core";
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
		return <Text size="sm">Loading...</Text>;
	}

	if (session) {
		return (
			<Group gap="md">
				<Text size="sm">
					{session.user.name} ({session.user.email})
				</Text>
				<Button
					color="red"
					size="xs"
					onClick={handleSignOut}
					loading={isSigningOut}
				>
					Sign Out
				</Button>
			</Group>
		);
	}

	return (
		<Button component={Link} to="/auth" size="xs">
			Sign In
		</Button>
	);
}
