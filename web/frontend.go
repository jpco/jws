package jpcowww

import (
	"fmt"
	"net/http"
	"os"
)

func gotoRedirect(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		fmt.Fprintf(w, "Got an oopsies: %v", err)
	}
	w.Header().Set("Location", fmt.Sprintf("https://go.jpco.io/%s?%s", r.URL.Path[4:], r.Form.Encode()))
	w.WriteHeader(http.StatusFound)
	fmt.Fprintf(w, "redirect")
}

// TODO: after hugo is properly set up, this should return a 404
func static(w http.ResponseWriter, r *http.Request) {
	http.NotFound(w, r)
}

func cert(w http.ResponseWriter, r *http.Request) {
	acmeValue := os.Getenv("ACME_VALUE")
	fmt.Fprint(w, acmeValue)
}

func init() {
	acmeKey := os.Getenv("ACME_KEY")
	if acmeKey != "" {
		http.HandleFunc("/.well-known/acme-challenge/"+acmeKey, cert)
	}

	http.HandleFunc("/go/", gotoRedirect)
	http.HandleFunc("/", static)
}
