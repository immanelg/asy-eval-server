package main

import "net/http"

type userID string

func userSessionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token, err := r.Cookie("session")
        if err != nil {
            // random string + created ts
        } else {

        }
        // set cookie to context
		next.ServeHTTP(w, r)
	})
}
