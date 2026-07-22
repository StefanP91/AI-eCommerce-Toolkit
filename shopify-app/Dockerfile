FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json* ./

# Install all deps for the build, then prune to production.
RUN npm ci && npm cache clean --force

COPY . .

RUN npm run build && npm prune --omit=dev

CMD ["npm", "run", "docker-start"]
