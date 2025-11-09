# Simple Asymptote Evaluation Server

## Running locally
Prerequisites:
- go 
- golang-migrate
- node, npm
- asymptote
- pdflatex
- pdf2svg
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
- Point DNS records to your machine
- Configure .env:
    * Set hostname 
    * Generate secret key
- Create ./data dir for volume. 
- (Placeholder database) ./data/db should be rw for your user: `sudo chown 1000:1000 data/db`, `chmod 600 data/db`
- Build and run:
```
docker compose up --build -d
```
You can deploy backend and frontend independently. In that case, remove one or the other from docker-compose file; for frontend, set appropriate API URL in .env.

## Features
- Interactive web app for compiling TeX and Asymptote to SVG, PNG, PDF.
- Automatic recompilation on timeout, saving editor state on localStorage, sharing links for code
- Saving output to filesystem, copying to clipboard, sharing 

## Technologies
Go, Caddy, TypeScript, Vite, Snabbdom (virtual DOM library), Docker Compose, SQLite
