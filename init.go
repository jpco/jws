package main

import (
	"net/http"
	"log"
	"os"
)

func main() {
	http.HandleFunc("/", http.NotFound)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Print(err)
	}
}
