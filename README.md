# Simple Asymptote Evaluation Server

## Running locally
Prerequisites:
- go 
- golang-migrate
- node, npm
- asymptote
- pdflatex
- latexmk

Build the app:
```
./do ui watch
./do api watch
```
This runs:
- Vite dev server on :5173 with hot reloading (proxies API requests to a different port)
- Go API server with hot reloading via watchexec

See ./do for other useful dev commands

## Deployment (Docker Compose)
1) (optional) TLS and DNS: set up DNS records
2) Set ASYEVAL_HOSTNAME env var in docker compose config.
2) Build and run:
```
docker compose up --build -d
```

## Features
- Interactive web app for compiling TeX and Asymptote to SVG, PNG, PDF.
- Automatic recompilation on timeout, saving editor state on localStorage, sharing links for code
- Saving output to filesystem, copying to clipboard, sharing 

## Technologies
Go, Caddy, TypeScript, Vite, Snabbdom (virtual DOM library), Docker Compose, SQLite
