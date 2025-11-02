FROM golang:1.24-alpine AS builder

COPY . /app
WORKDIR /app

RUN CGO_ENABLED=0 go build -ldflags '-s -w -extldflags "-static"' -o /app/appbin *.go

FROM alpine:3.19

RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories && \
    apk update && \
    apk add --no-cache asymptote ca-certificates

RUN adduser -D appuser
USER appuser

COPY --from=builder /app /home/app/app

WORKDIR /home/app/app

# Since running as a non-root user, port bindings < 1024 is not possible
# 8000 for HTTP; 8443 for HTTPS;
EXPOSE 8000
EXPOSE 8443

CMD ["./appbin", "-addr", "0.0.0.0:8000"]
