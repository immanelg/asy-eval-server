FROM node:22-alpine AS ui-files

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN ./node_modules/.bin/vite build

# Multistage: build static dist first, then build reverse proxy for dist and api

FROM caddy:alpine

COPY --from=ui-files /app/dist /srv

COPY ./Caddyfile /etc/caddy/Caddyfile
