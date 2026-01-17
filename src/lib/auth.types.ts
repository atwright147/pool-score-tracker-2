// Shared types for auth - safe to import on client or server
export type Session = {
	user: {
		id: string;
		name: string;
		email: string;
		emailVerified: boolean;
		image?: string;
		createdAt: Date;
		updatedAt: Date;
	};
	session: {
		id: string;
		userId: string;
		expiresAt: Date;
		token: string;
		ipAddress?: string;
		userAgent?: string;
	};
};
