# Simple Asymptote Evaluation Server


# Running locally
Build backend and frontend with reloading:
```
./do ui watch  # opens browser
./do api watch
```

# Stack
API server:
- Go
- golang-migrate, SQLite
- Asymptote and PDFLatex backend
Client:
- TypeScript
- Vite build system
- Snabbdom for virtual DOM
Deployment:
- Docker Compose build for production
- Caddy as a reverse proxy for serving UI files and API

# Production deployment
- (optional) TLS and DNS: set up DNS records; in ui/Caddyfile configure hostname and set port 443.
- Use Docker Compose to deploy:
```
docker compose up --build -d
```
