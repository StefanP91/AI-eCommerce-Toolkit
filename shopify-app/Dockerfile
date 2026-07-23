FROM node:22-alpine
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production
# Render injects PORT at runtime — do not hardcode a conflicting value.

COPY package.json package-lock.json* ./

# Install all deps for the build, then prune to production.
RUN npm ci && npm cache clean --force

COPY . .

# Generate client AFTER schema is present (npm ci postinstall runs too early).
RUN npx prisma generate && npm run build && npm prune --omit=dev

# Isolate Shopify tables in schema "shopify" so Laravel public tables are untouched.
CMD ["sh", "-c", "printf '%s\\n' 'CREATE SCHEMA IF NOT EXISTS \"shopify\";' | npx prisma db execute --stdin --schema prisma/schema.prisma && npx prisma db push --schema prisma/schema.prisma && exec npx react-router-serve ./build/server/index.js"]

EXPOSE 3000
