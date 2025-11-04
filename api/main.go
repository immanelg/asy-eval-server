package main

import (
	"context"
	"flag"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

func handleCompilation(w http.ResponseWriter, r *http.Request) {
	tmpdir, err := os.MkdirTemp("", "asy-eval-1")
	if err != nil {
		slogger.ErrorContext(r.Context(), "create temp dir failed", "error", err)
	}
	slogger.InfoContext(r.Context(), "create tmpdir", "path", tmpdir)
	defer os.RemoveAll(tmpdir)

	inpf, err := os.Create(filepath.Join(tmpdir, "input.asy"))
	if err != nil {
		slogger.ErrorContext(r.Context(), "create input file failed", "error", err)
	}
	slogger.InfoContext(r.Context(), "create input.asy")
	defer func() {
		if err := inpf.Close(); err != nil {
			slogger.ErrorContext(r.Context(), "close input file failed", "error", err)
		}
	}()

	buf := make([]byte, 512)
	for {
		n, err := r.Body.Read(buf)
		if err != nil && err != io.EOF {
			slogger.ErrorContext(r.Context(), "read body failed", "error", err)
		}
		if n == 0 {
			break
		}

		if _, err := inpf.Write(buf[:n]); err != nil {
			slogger.ErrorContext(r.Context(), "write to input file failed", "error", err)
		}
	}

	accept := r.Header.Get("Accept")
	var fmt string = "svg"
	// fmts := make([]string, 0, 4)
	// if strings.Contains(accept, "application/pdf") { fmts = append(fmts, "pdf") }
	// if strings.Contains(accept, "application/svg+xml") { fmts = append(fmts, "svg") }
	// if strings.Contains(accept, "image/png") { fmts = append(fmts, "png") }

	if strings.Contains(accept, "application/pdf") {
		fmt = "pdf"
	} else if strings.Contains(accept, "application/svg+xml") {
		fmt = "svg"
	} else if strings.Contains(accept, "image/png") {
		fmt = "png"
	}


	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second); defer cancel()
	cmd := exec.CommandContext(ctx, "asy", "input.asy", "-safe", "-f", fmt, "-o", "output")
	cmd.Dir = tmpdir
	slogger.InfoContext(r.Context(), "exec asy cmd", "args", cmd.Args)

	outputb, err := cmd.CombinedOutput()
	slogger.InfoContext(r.Context(), "output", "output", string(outputb))
	const compilerErrorMimeType = "text/vnd.asy-compiler-error"
	if err != nil {
		slogger.WarnContext(r.Context(), "exec asy cmd error", "error", err)
		// TODO: maybe parse errors to json server side
		w.Header().Add("Content-Type", compilerErrorMimeType)
		w.WriteHeader(200)
		w.Write(outputb)
	} else {
		outfilepath := filepath.Join(tmpdir, "output."+fmt)
		if _, err := os.Stat(outfilepath); err != nil {
			slogger.WarnContext(r.Context(), "cannot stat output file to serve it", "error", err)
			w.Header().Add("Content-Type", compilerErrorMimeType)
			w.WriteHeader(200)
			w.Write([]byte("no output"))
		} else {
			http.ServeFile(w, r, outfilepath)
		}
	}
}

func main() {
	mux := http.NewServeMux()

	mux.Handle("POST /eval", http.HandlerFunc(handleCompilation))

	var addr string
	flag.StringVar(&addr, "addr", "0.0.0.0:8080", "address to use")
	flag.Parse()
	slogger.Info("starting server", "addr", addr)
	err := http.ListenAndServe(addr, corsMiddleware(loggingMiddleware(mux)))
	if err != nil {
		slog.Error("listen", "failed to listen", err)
	}
	// log.Fatal(http.ListenAndServe(addr, mux))
}
