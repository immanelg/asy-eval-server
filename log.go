package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"sync/atomic"
)

var slogger *slog.Logger

type slogHandler struct {
	slog.Handler
}

func (h slogHandler) Handle(ctx context.Context, record slog.Record) error {
	if requestID, ok := ctx.Value(contextKeyRequestID).(string); ok { //not inside request
		record.Add("rid", slog.StringValue(requestID))
	}
	return h.Handler.Handle(ctx, record)
}

const contextKeyRequestID = "requestID"

func init() {
	baseHandler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	slogger = slog.New(slogHandler{baseHandler})
}

var nextReqId atomic.Uint64

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := fmt.Sprintf("%d", nextReqId.Load())
		nextReqId.Add(1)

		ctx := context.WithValue(r.Context(), contextKeyRequestID, requestID)
		r = r.WithContext(ctx)

		slogger.InfoContext(ctx, "start request", "method", r.Method, "path", r.URL.Path)
		w.Header().Set("Request-ID", requestID)
		defer slogger.InfoContext(ctx, "done request")

		next.ServeHTTP(w, r)
	})
}
