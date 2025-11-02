package main

import (
	"flag"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func serveHtml(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "index.html")
}

func handleCompilation(w http.ResponseWriter, r *http.Request) {
	// data, err := io.ReadAll(r.Body)
	// if err != nil {
	//  logger.ErrorContext(r.Context(), "read body failed", "error", err)
	// }
	// expr := string(data)
	// logger.InfoContext(r.Context(), "expr", "expr", expr)

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

	cmd := exec.Command("asy", "input.asy", "-safe", "-f", fmt, "-o", "output")
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
			w.WriteHeader(204) // https://http.cat/204
			w.Write([]byte("no output"))
		} else {
			http.ServeFile(w, r, outfilepath)
		}
	}
}

func main() {
	mux := http.NewServeMux()

	mux.Handle("GET /", corsMiddleware(loggingMiddleware(http.HandlerFunc(serveHtml))))
	mux.Handle("POST /eval", corsMiddleware(loggingMiddleware(http.HandlerFunc(handleCompilation))))

	var addr = "localhost:8000"
	flag.StringVar(&addr, "addr", "localhost:8000", "address to use")
	flag.Parse()
	slogger.Info("starting server", "addr", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
