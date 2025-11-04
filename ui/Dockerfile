FROM node:22-alpine AS ui-files

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN ./node_modules/.bin/vite build

# Multistage: build static dist first, then build reverse proxy for dist and api

FROM caddy:alpine

COPY --from=ui-files /app/dist /usr/share/caddy

COPY ./Caddyfile /etc/caddy/Caddyfile
