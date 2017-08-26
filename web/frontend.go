package jpcowww

import (
	"fmt"
	"net/http"
	"os"
)

func gotoRedirect(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Location", fmt.Sprintf("https://go.jpco.io/%s", r.URL.Path[4:]))
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
	http.HandleFunc("/.well-known/acme-challenge/2ymobkkpKzxlRiCbbrJBKk9bLuCTzSv0xg7FsjcjSkU", cert)

	http.HandleFunc("/go/", gotoRedirect)
	http.HandleFunc("/", static)
}
