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

# Shared Render Postgres already has Laravel tables (P3005 on migrate deploy).
# db push creates only missing Shopify tables without requiring an empty database.
CMD ["sh", "-c", "npx prisma db push --skip-generate && exec npx react-router-serve ./build/server/index.js"]

EXPOSE 3000
