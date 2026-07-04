# Build context for this Dockerfile is the REPO ROOT (see docker-compose.yml)
# because the backend needs the sibling mcp-server/ package built alongside it.

FROM node:20-alpine AS mcp-build
WORKDIR /app/mcp-server
COPY mcp-server/package*.json ./
RUN npm install
COPY mcp-server/ ./
RUN npm run build

FROM node:20-alpine AS backend-build
RUN apk add --no-cache python3 make g++
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app

COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/package*.json ./backend/
COPY --from=backend-build /app/backend/data ./backend/data

COPY --from=mcp-build /app/mcp-server/dist ./mcp-server/dist
COPY --from=mcp-build /app/mcp-server/node_modules ./mcp-server/node_modules
COPY --from=mcp-build /app/mcp-server/package*.json ./mcp-server/

WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "dist/server.js"]
