FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .

ENV NITRO_PRESET=node-server
RUN npm run build

FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=7001

COPY --from=build /app/.output ./.output

EXPOSE 7001

CMD ["node", ".output/server/index.mjs"]
