import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { useId, useState } from "react";
import { signIn, signUp, useSession } from "~/lib/auth-client";

export const Route = createFileRoute("/auth")({
	component: AuthPage,
	validateSearch: (search: Record<string, unknown>) => {
		return {
			redirect: (search.redirect as string) || "/",
		};
	},
});

function AuthPage() {
	const { data: session, isPending } = useSession();
	const navigate = useNavigate();
	const search = useSearch({ from: "/auth" });
	const [isSignUp, setIsSignUp] = useState(false);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const nameId = useId();
	const emailId = useId();
	const passwordId = useId();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			if (isSignUp) {
				const result = await signUp.email({
					email,
					password,
					name,
				});
				if (result.error) {
					setError(result.error.message || "Sign up failed");
					return;
				}
			} else {
				const result = await signIn.email({
					email,
					password,
				});
				if (result.error) {
					setError(result.error.message || "Sign in failed");
					return;
				}
			}
			// Redirect to the intended page or home
			await navigate({ to: search.redirect as string });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Authentication failed");
		} finally {
			setLoading(false);
		}
	};

	if (isPending) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				Loading...
			</div>
		);
	}

	if (session) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen gap-4">
				<h1 className="text-2xl font-bold">Welcome, {session.user.name}!</h1>
				<p className="text-gray-600">Email: {session.user.email}</p>
			</div>
		);
	}

	return (
		<div className="flex items-center justify-center min-h-screen bg-gray-50">
			<div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
				<h2 className="text-2xl font-bold text-center">
					{isSignUp ? "Sign Up" : "Sign In"}
				</h2>

				<form onSubmit={handleSubmit} className="space-y-4">
					{isSignUp && (
						<div>
							<label
								htmlFor={nameId}
								className="block text-sm font-medium text-gray-700"
							>
								Name
							</label>
							<input
								id={nameId}
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required={isSignUp}
								className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>
					)}

					<div>
						<label
							htmlFor={emailId}
							className="block text-sm font-medium text-gray-700"
						>
							Email
						</label>
						<input
							id={emailId}
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label
							htmlFor={passwordId}
							className="block text-sm font-medium text-gray-700"
						>
							Password
						</label>
						<input
							id={passwordId}
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					{error && (
						<div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
							{error}
						</div>
					)}

					<button
						type="submit"
						disabled={loading}
						className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
					>
						{loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
					</button>
				</form>

				<div className="text-center">
					<button
						type="button"
						onClick={() => setIsSignUp(!isSignUp)}
						className="text-sm text-blue-600 hover:underline"
					>
						{isSignUp
							? "Already have an account? Sign in"
							: "Need an account? Sign up"}
					</button>
				</div>
			</div>
		</div>
	);
}
