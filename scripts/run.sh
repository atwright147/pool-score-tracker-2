#!/bin/sh
set -e

echo "Running database migrations..."
# 'push' is great for prototyping; use 'migrate' if using SQL migration files
npx drizzle-kit push:sqlite

echo "Starting TanStack Start server..."
node .output/server/index.mjs
