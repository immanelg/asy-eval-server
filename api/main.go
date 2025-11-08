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
    slogger.DebugContext(r.Context(), "create tmpdir", "path", tmpdir)
    defer os.RemoveAll(tmpdir)

    var ofmt string
    var ifmt string
    query := r.URL.Query()
    ofmt = query.Get("o")
    ifmt = query.Get("i")

    // may be different later. maybe.
    var iext string
    switch ifmt {
    case "asy": iext = ifmt
    case "tex": iext = ifmt
    default: 
        http.Error(w, "invalid input type", http.StatusBadRequest)
        return
    }
    var oext string
    switch ofmt {
    case "svg": oext = ofmt
    case "pdf": oext = ofmt
    case "png": oext = ofmt
    default: 
        http.Error(w, "invalid output type", http.StatusBadRequest)
        return
    }

    var inputName = "input." + iext
    var outputName = "input." + oext

    inputFullPath := filepath.Join(tmpdir, inputName)
    outputFullPath := filepath.Join(tmpdir, outputName)

    inpf, err := os.Create(inputFullPath)
    if err != nil {
        slogger.ErrorContext(r.Context(), "create input file failed", "error", err)
        http.Error(w, "cannot create input file", http.StatusInternalServerError)
        return
    }
    slogger.DebugContext(r.Context(), "create input file")
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
            http.Error(w, "cant read body", http.StatusInternalServerError)
            return
        }
        if n == 0 {
            break
        }

        if _, err := inpf.Write(buf[:n]); err != nil {
            slogger.ErrorContext(r.Context(), "write to input file failed", "error", err)
            http.Error(w, "cannot write to input file", http.StatusInternalServerError)
            return
        }
    }

    var args []string
    switch ifmt {
    case "tex":
        args = []string{"latexmk", "-pdf", inputName}
    case "asy":
        args = []string{"asy", inputName, "-safe", "-f", ofmt, "-o", "input"}
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    cmd := exec.CommandContext(ctx, args[0], args[1:]...)
    cmd.Dir = tmpdir
    slogger.DebugContext(r.Context(), "exec cmd", "args", cmd.Args)

    outputb, err := cmd.CombinedOutput()
    slogger.DebugContext(r.Context(), "output", "output", string(outputb))
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

}

func incCompilations(userID int) error {
    _, err := db.Exec("UPDATE users SET evals = evals + 1 WHERE id = ?", userID)
    return err
}

func main() {
    mux := http.NewServeMux()

    mux.Handle("POST /eval", http.HandlerFunc(handleCompilation))

    var addr string
    flag.StringVar(&addr, "addr", "0.0.0.0:8080", "address to use")
    flag.Parse()

    slogger.Info("starting server", "addr", addr)

    initDB()
    defer closeDB()

    err := http.ListenAndServe(addr, 
        errorHandlingMiddleware(
        loggingMiddleware(
        corsMiddleware(
        userSessionMiddleware(
            mux)))))
    if err != nil {
        slog.Error("listen", "failed to listen", err)
    }
}
