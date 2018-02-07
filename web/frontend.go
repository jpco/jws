package jpcowww

import (
	"fmt"
	"net/http"
)

func gotoRedirect(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		fmt.Fprintf(w, "Got an oopsies: %v", err)
	}
	w.Header().Set("Location", fmt.Sprintf("https://go.jpco.io/%s?%s", r.URL.Path[4:], r.Form.Encode()))
	w.WriteHeader(http.StatusFound)
	fmt.Fprintf(w, "redirect")
}

func static(w http.ResponseWriter, r *http.Request) {
	http.NotFound(w, r)
}

func init() {
	http.HandleFunc("/go/", gotoRedirect)
	http.HandleFunc("/", static)
}
