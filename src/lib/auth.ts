import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { db } from '~/db/db';
import * as schema from '~/db/schema';

// Conditionally import Resend if API key is available
let resend: any = null;
if (process.env.RESEND_API_KEY) {
	try {
		const { Resend } = require('resend');
		resend = new Resend(process.env.RESEND_API_KEY);
	} catch (_error) {
		console.warn('Resend package not installed. Email verification disabled.');
	}
}

// Validate secret key in production
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret && process.env.NODE_ENV === 'production') {
	throw new Error(
		'BETTER_AUTH_SECRET environment variable is required in production',
	);
}

// Configure trusted origins based on environment
const getTrustedOrigins = () => {
	const origins = ['http://localhost:3000']; // Default for development

	// Add production/staging origins from environment
	if (process.env.BETTER_AUTH_URL) {
		origins.push(process.env.BETTER_AUTH_URL);
	}

	// Allow additional origins via comma-separated list
	if (process.env.TRUSTED_ORIGINS) {
		origins.push(...process.env.TRUSTED_ORIGINS.split(','));
	}

	return origins;
};

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification,
		},
	}),
	emailAndPassword: {
		enabled: true,
		// Require minimum password length
		minPasswordLength: 8,
	},
	...(resend && {
		emailVerification: {
			sendVerificationEmail: async ({ user, url }) => {
				try {
					await resend.emails.send({
						from: process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev',
						to: user.email,
						subject: 'Verify your email',
						html: `
							<p>Welcome to Score Tracker!</p>
							<p><a href="${url}">Click here to verify your email</a></p>
							<p>This link expires in 24 hours.</p>
						`,
					});
				} catch (error) {
					console.error('Failed to send verification email:', error);
					throw error;
				}
			},
		},
	}),
	secret: secret ?? 'dev-secret-DO-NOT-USE-IN-PRODUCTION',
	trustedOrigins: getTrustedOrigins(),
	// Optional: Add social providers
	// socialProviders: {
	//   github: {
	//     clientId: process.env.GITHUB_CLIENT_ID!,
	//     clientSecret: process.env.GITHUB_CLIENT_SECRET!,
	//   },
	// },
});
