# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm (optional, change to npm if preferred)
RUN npm install -g pnpm

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm run build
# Generate drizzle migrations if they don't exist
RUN pnpm drizzle-kit generate || true

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create necessary directories
RUN mkdir -p /app/data /app/drizzle

# We only need the .output folder and any migration files
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json
# Copy drizzle migrations if they exist (using shell to handle missing dir)
RUN --mount=type=bind,from=builder,source=/app/drizzle,target=/tmp/drizzle \
    cp -r /tmp/drizzle/* ./drizzle/ 2>/dev/null || true

# If you use drizzle-kit for migrations at runtime
RUN npm install -g drizzle-kit

# Entrypoint script to run migrations then start the app
COPY scripts/run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 3000

CMD ["/run.sh"]
