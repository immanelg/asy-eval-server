package main

import (
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Hello, %q", html.EscapeString(r.URL.Path))
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
			if err != nil {
				log.Fatal(err)
			}

			cmd := exec.Command("asy", "input.asy")
			cmd.Dir = tmpdir
			output, err := cmd.CombinedOutput()
			log.Print("output: ", string(output))
			if err != nil {
				log.Fatal(err)
			}
		}
	})

	log.Fatal(http.ListenAndServe(":5001", nil))
}
