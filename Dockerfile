FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY package.json bun.lock server.js ./
RUN npm install --omit=dev

COPY --from=build /app/build ./build
COPY --from=build /app/public ./public

EXPOSE 3000

CMD ["npm", "start"]
