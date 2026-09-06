# Build the web app and the server in one image; the server also serves the
# web build at "/" so the newsletter is reachable from a browser too.
FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY app/package.json app/
COPY server/package.json server/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build -w app && npm run build -w server

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /srv
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY app/package.json app/
COPY server/package.json server/
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /src/server/dist server/dist
COPY --from=build /src/app/dist app/dist
COPY shared shared
ENV PORT=8080 DATA_DIR=/data WEB_DIR=/srv/app/dist
VOLUME ["/data"]
EXPOSE 8080
WORKDIR /srv/server
CMD ["node", "dist/server/src/index.js"]
