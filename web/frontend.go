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

const file404 = `
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>404</title><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge" /><link rel="stylesheet" href="/css/main.css"></head>
<body>
<div class="content">
	<p>404</p>
	<p><a href="/">goto /</a></p>
	<p><a href="#" onclick="window.history.back()">go back</a></p>
</div>
</body></html>`

// TODO: after hugo is properly set up, this should return a 404
func static(w http.ResponseWriter, r *http.Request) {
	// if strings.HasSuffix(r.URL.Path, "/") {
	w.WriteHeader(http.StatusNotFound)
	fmt.Fprint(w, file404)
	//} else {
	//http.Redirect(w, r, r.URL.Path+"/", http.StatusFound)
	//}
}

func cert(w http.ResponseWriter, r *http.Request) {
	acmeValue := os.Getenv("ACME_VALUE")
	fmt.Fprint(w, acmeValue)
}

func init() {
	http.HandleFunc("/.well-known/acme-challenge/1914EEpYxXJzea3KgLPgO_qBNMFV6OkSPO_P2JP4n0g", cert)

	http.HandleFunc("/go/", gotoRedirect)
	http.HandleFunc("/", static)
}
