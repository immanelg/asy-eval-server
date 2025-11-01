package main

import (
	// "fmt"
	// "html"
	"flag"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func compile() {
}
func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "index.html")
	})

	http.HandleFunc("/eval", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			// data, err := io.ReadAll(r.Body)
			// if err != nil {
			// 	log.Fatal(err)
			// }
			// expr := string(data)
			// log.Println("expr:", expr)

			tmpdir, err := os.MkdirTemp("", "asy-eval-1")
			if err != nil {
				log.Fatal(err)
			}
			log.Println("tmpdir:", tmpdir)
			defer os.RemoveAll(tmpdir)

			inpf, err := os.Create(filepath.Join(tmpdir, "input.asy"))
			if err != nil {
				log.Fatal(err)
			}
			defer func() {
				if err := inpf.Close(); err != nil {
					log.Fatal(err)
				}
			}()

			buf := make([]byte, 512)
			for {
				n, err := r.Body.Read(buf)
				if err != nil && err != io.EOF {
					log.Fatal(err)
				}
				if n == 0 {
					break
				}

				if _, err := inpf.Write(buf[:n]); err != nil {
					log.Fatal(err)
				}
			}

			accept := r.Header.Get("Accept")
			var fmt string = "svg"
			// fmts := make([]string, 0, 4)
			// if strings.Contains(accept, "application/pdf") { fmts = append(fmts, "pdf") }
			// if strings.Contains(accept, "application/svg+xml") { fmts = append(fmts, "svg") }
			// if strings.Contains(accept, "image/png") { fmts = append(fmts, "png") }
			if strings.Contains(accept, "application/pdf") { fmt = "pdf" 
			} else if strings.Contains(accept, "application/svg+xml") { fmt = "svg" 
			} else if strings.Contains(accept, "image/png") { fmt = "png" }
			cmd := exec.Command("asy", "input.asy", "-safe", "-f", fmt, "-o", "output")
			log.Print("eval command line: ", strings.Join(cmd.Args, " "))
			cmd.Dir = tmpdir
			outputb, err := cmd.CombinedOutput()
			log.Print("output: ", string(outputb))
			if err != nil {
				log.Print("eval error: ", err)
				// TODO: maybe parse errors to json server side
				w.Header().Add("Content-Type", "text/vnd.asy-compiler-error")
				w.WriteHeader(200)
				w.Write(outputb)
			} else {
				http.ServeFile(w, r, filepath.Join(tmpdir, "output."+fmt))
			}
		} else {
			http.NotFound(w, r)
		}
	})

	var addr = "localhost:5001"
	flag.StringVar(&addr,"addr", "localhost:5001", "address to use")
	flag.Parse()
	log.Print("listening on: ", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
