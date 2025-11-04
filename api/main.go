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
	"time"
)

func handleCompilation(w http.ResponseWriter, r *http.Request) {
	tmpdir, err := os.MkdirTemp("", "asy-eval")
	if err != nil {
		slogger.ErrorContext(r.Context(), "create temp dir failed", "error", err)
	}
	slogger.InfoContext(r.Context(), "create tmpdir", "path", tmpdir)
	defer os.RemoveAll(tmpdir)

	var ofmt string
	var ifmt string
    query := r.URL.Query()
    ofmt = query.Get("o")
    ifmt = query.Get("i")

    // may be different later. maybe.
    var iext string
    iext = ifmt
    var oext string
    oext = ofmt

    var inputName = "input."+iext
    var outputName = "input."+oext

    inputFullPath := filepath.Join(tmpdir, inputName)
    outputFullPath := filepath.Join(tmpdir, outputName)

	inpf, err := os.Create(inputFullPath)
	if err != nil {
		slogger.ErrorContext(r.Context(), "create input file failed", "error", err)
	}
	slogger.InfoContext(r.Context(), "create input")
	defer func() {
		if err := inpf.Close(); err != nil {
			slogger.ErrorContext(r.Context(), "close input file failed", "error", err)
		}
	}()

	buf := make([]byte, 512)
	for {

        // TODO: max file size (or in reverse proxy)
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

	// accept := r.Header.Get("Accept")
	// var fmt string = "svg"

	// if strings.Contains(accept, "application/pdf") {
	// 	ofmt = "pdf"
	// } else if strings.Contains(accept, "application/svg+xml") {
	// 	ofmt = "svg"
	// } else if strings.Contains(accept, "image/png") {
	// 	ofmt = "png"
	// }
    switch ifmt {
    case "tex":
        // _cntnt := `\documentclass{article}
        //             \usepackage[utf8]{inputenc}
        //             \usepackage{graphicx}
        //             \usepackage{hyperref}
        //             \begin{document}
        //             \section{Advanced Document}
        //             Hello from Go + LaTeX!
        //             \subsection{Dynamic Content}
        //             Generated at: \today
        //             \end{document}`

        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()
        cmd := exec.CommandContext(ctx, "latexmk", "-pdf", inputName)
        cmd.Dir = tmpdir
        slogger.InfoContext(r.Context(), "exec", "args", cmd.Args)

        outputb, err := cmd.CombinedOutput()
        slogger.InfoContext(r.Context(), "output", "output", string(outputb))
        const compilerErrorMimeType = "text/vnd.asy-compiler-error"
        if err != nil {
            slogger.WarnContext(r.Context(), "exec error", "error", err)
            // TODO: maybe parse errors to json server side
            w.Header().Add("Content-Type", compilerErrorMimeType)
            w.WriteHeader(200)
            w.Write(outputb)
        } else {
            if _, err := os.Stat(outputFullPath); err != nil {
                slogger.WarnContext(r.Context(), "cannot stat output file to serve it", "error", err)
                w.Header().Add("Content-Type", compilerErrorMimeType)
                w.WriteHeader(200)
                w.Write([]byte("no output"))
            } else {
                http.ServeFile(w, r, outputFullPath)
            }
        }

    case "asy":
        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()
        cmd := exec.CommandContext(ctx, "asy", inputName, "-safe", "-f", ofmt, "-o", "output")
        cmd.Dir = tmpdir
        slogger.InfoContext(r.Context(), "exec cmd", "args", cmd.Args)

        outputb, err := cmd.CombinedOutput()
        slogger.InfoContext(r.Context(), "output", "output", string(outputb))
        const compilerErrorMimeType = "text/vnd.asy-compiler-error"
        if err != nil {
            slogger.WarnContext(r.Context(), "exec error", "error", err)
            // TODO: maybe parse errors to json server side
            w.Header().Add("Content-Type", compilerErrorMimeType)
            w.WriteHeader(200)
            w.Write(outputb)
        } else {
            outfilepath := filepath.Join(tmpdir, "output."+ofmt)
            if _, err := os.Stat(outfilepath); err != nil {
                slogger.WarnContext(r.Context(), "cannot stat output file to serve it", "error", err)
                w.Header().Add("Content-Type", compilerErrorMimeType)
                w.WriteHeader(200)
                w.Write([]byte("no output"))
            } else {
                http.ServeFile(w, r, outfilepath)
            }
        }
    default:
        w.WriteHeader(http.StatusBadRequest)
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
