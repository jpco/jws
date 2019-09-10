package main

import (
	"fmt"
	"log"
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

func static(w http.ResponseWriter, r *http.Request) {
	http.NotFound(w, r)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
		log.Printf("Defaulting to port %s", port)
	}

	http.HandleFunc("/go/", gotoRedirect)
	http.HandleFunc("/", static)

	log.Printf("Listening on port %s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), nil))
}
