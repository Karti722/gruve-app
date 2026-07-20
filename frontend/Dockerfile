FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Next.js inlines NEXT_PUBLIC_* vars into the client JS bundle at build time
# by reading them from the actual build-time environment, a Docker
# --build-arg alone isn't enough: it has to be declared with ARG and promoted
# to ENV before `next build` runs, or it's silently ignored and the code's
# own fallback (see lib/api.ts) gets baked in instead.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package*.json ./
COPY --from=build /app/next.config.js ./

EXPOSE 3000
CMD ["npm", "start"]
