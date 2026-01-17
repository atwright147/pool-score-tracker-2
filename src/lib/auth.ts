import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { db } from '~/db/db';
import * as schema from '~/db/schema';

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
	secret: secret || 'dev-secret-DO-NOT-USE-IN-PRODUCTION',
	trustedOrigins: getTrustedOrigins(),
	// Optional: Add social providers
	// socialProviders: {
	//   github: {
	//     clientId: process.env.GITHUB_CLIENT_ID!,
	//     clientSecret: process.env.GITHUB_CLIENT_SECRET!,
	//   },
	// },
});
