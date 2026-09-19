# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# vocabulary.json is imported at build time through the @data alias, so the
# data directory has to be present in the build context.
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
RUN npm install -g serve@14
EXPOSE 5173
# -s rewrites unknown paths to index.html, which the client-side router needs.
CMD ["serve", "-s", "dist", "-l", "5173"]
