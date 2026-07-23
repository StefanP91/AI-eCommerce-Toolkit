FROM node:22-alpine
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production
# Render injects PORT at runtime — do not hardcode a conflicting value.

COPY package.json package-lock.json* ./

# Install all deps for the build, then prune to production.
RUN npm ci && npm cache clean --force

COPY . .

RUN npm run build && npm prune --omit=dev

# Isolate Shopify tables in schema "shopify" so Laravel public tables are untouched.
# Do NOT use --accept-data-loss (would risk Laravel data on shared DB).
CMD ["sh", "-c", "printf '%s\\n' 'CREATE SCHEMA IF NOT EXISTS \"shopify\";' | npx prisma db execute --stdin && npx prisma db push --skip-generate && exec npx react-router-serve ./build/server/index.js"]

EXPOSE 3000
