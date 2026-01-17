# Better Auth Setup Guide

## Overview
This project uses **better-auth** for authentication with TanStack Start and Drizzle ORM.

## Files Created

### Auth Configuration
- [src/lib/auth.ts](src/lib/auth.ts) - Server-side auth configuration
- [src/lib/auth-client.ts](src/lib/auth-client.ts) - Client-side auth utilities

### Database Schema
- [src/db/schema.ts](src/db/schema.ts) - Updated with better-auth tables:
  - `user` - User accounts
  - `session` - User sessions
  - `account` - OAuth accounts and credentials
  - `verification` - Email verification tokens

### Routes
- [src/routes/api/auth/$.ts](src/routes/api/auth/$.ts) - Auth API endpoint (catch-all route)
- [src/routes/auth.tsx](src/routes/auth.tsx) - Sign in/up page example

### Components
- [src/components/AuthButton.tsx](src/components/AuthButton.tsx) - Reusable auth button component

## Usage

### 1. Environment Variables
Create a `.env` file in the project root:

```env
BETTER_AUTH_SECRET=your-super-secret-key-here-change-in-production
# Optional: For OAuth providers
# GITHUB_CLIENT_ID=your-github-client-id
# GITHUB_CLIENT_SECRET=your-github-client-secret
```

### 2. Using Auth in Components

```tsx
import { useSession, signIn, signUp, signOut } from "~/lib/auth-client";

function MyComponent() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;

  if (session) {
    return (
      <div>
        <p>Welcome, {session.user.name}!</p>
        <button onClick={() => signOut()}>Sign Out</button>
      </div>
    );
  }

  return <a href="/auth">Sign In</a>;
}
```

### 3. Sign Up
```tsx
await signUp.email({
  email: "user@example.com",
  password: "securePassword123",
  name: "John Doe",
});
```

### 4. Sign In
```tsx
await signIn.email({
  email: "user@example.com",
  password: "securePassword123",
});
```

### 5. Sign Out
```tsx
await signOut();
```

### 6. Protected Routes
Create a loader to check authentication:

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { auth } from "~/lib/auth";

export const Route = createFileRoute("/protected")({
  beforeLoad: async ({ request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw redirect({ to: "/auth" });
    }

    return { session };
  },
  component: ProtectedComponent,
});
```

## Production Checklist

1. ✅ Set `BETTER_AUTH_SECRET` in production environment
2. ✅ Update `baseURL` in [src/lib/auth-client.ts](src/lib/auth-client.ts) to your production URL
3. ✅ Configure OAuth providers if needed
4. ✅ Set up email verification (optional)
5. ✅ Configure CORS if frontend and backend are on different domains

## Available Features

- ✅ Email & Password authentication
- ✅ Session management
- ✅ Drizzle ORM integration
- 🔧 OAuth providers (configurable)
- 🔧 Email verification (configurable)
- 🔧 Password reset (configurable)

## Database Commands

- `pnpm db:generate` - Generate migrations
- `pnpm db:push` - Push schema to database
- `pnpm db:studio` - Open Drizzle Studio

## Resources

- [Better Auth Docs](https://better-auth.com)
- [TanStack Start Docs](https://tanstack.com/start)
- [Drizzle ORM Docs](https://orm.drizzle.team)
