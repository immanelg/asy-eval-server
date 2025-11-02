# Simple Asymptote Evaluation Server

## Docker
Alpine image for running the API server.
```
docker build -t asy-dumb-server -f Dockerfile .
```
```
docker run  -p 8000:8000 --rm -ti asy-dumb-server
```
## Run directly
API Server:
```sh
go run . -addr localhost:8000
```

Preact app:
```sh
firefox localhost:8000
```


