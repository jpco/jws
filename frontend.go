package jpcowww

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"

	"google.golang.org/appengine"
	"google.golang.org/appengine/user"

	_ "github.com/go-sql-driver/mysql"
)

// TODO: "a blog".  let's get rid of ghost, we don't really need it, we have es + app engine + storage + sql
func blog(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "this is the blog")
}

var gotoDests = map[string]string{}

func sqlOpen() (*sql.DB, error) {
	conn := os.Getenv("CLOUDSQL_CONNECTION_NAME")
	user := os.Getenv("CLOUDSQL_USER")
	pass := os.Getenv("CLOUDSQL_PASSWORD")

	return sql.Open("mysql", fmt.Sprintf("%s:%s@cloudsql(%s)/goto", user, pass, conn))
}

func gotoUpdate(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		fmt.Fprintf(w, "error (1) %v", err)
		return
	}
	db, err := sqlOpen()
	if err != nil {
		fmt.Fprintf(w, "error (2) %v", err)
		return
	}
	defer db.Close()
	for key, vr := range r.Form {
		for _, x := range vr {
			if x == "" {
				delete(gotoDests, key)
				if _, err := db.Exec(`DELETE FROM goto WHERE SRC = ?`, key); err == nil {
					fmt.Fprintf(w, "unset %s", key)
				} else {
					fmt.Fprintf(w, "error unsetting %s: %s", key, err)
				}
			} else {
				gotoDests[key] = x
				if _, err := db.Exec(`INSERT INTO goto (src, dest) VALUES (?, ?)
									  ON DUPLICATE KEY UPDATE src = VALUES(src), 
										dest = VALUES(dest),
										exp = VALUES(exp)`, key, x); err == nil {
					fmt.Fprintf(w, "set %s to go to %s\n", key, x)
				} else {
					fmt.Fprintf(w, "error setting %s to %s: %s\n", key, x, err)
				}
			}
		}
	}
}

func gotoService(w http.ResponseWriter, r *http.Request) {
	src := r.URL.Path[4:]
	if src == "" {
		ctx := appengine.NewContext(r)
		if user.Current(ctx) != nil {
			for key, val := range gotoDests {
				fmt.Fprintf(w, "%s: %s<br />\n", key, val)
			}
			return
		}
	}

	dest, ok := gotoDests[src]
	var err error

	if !ok {
		db, e2 := sqlOpen()
		if e2 != nil {
			fmt.Fprintf(w, "error (2) %v", e2)
			return
		}
		defer db.Close()

		err = db.QueryRow("SELECT dest FROM goto WHERE src = ?", src).Scan(&dest)
		if err == nil {
			gotoDests[src] = dest
		}
	}

	if ok || err == nil {
		w.Header().Set("Location", dest)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusFound)
		fmt.Fprintf(w, "headed to '<a href='%s'>%s</a>'", dest, dest)
	} else if err == sql.ErrNoRows {
		fmt.Fprintf(w, "no destination for '%s'", src)
	} else {
		fmt.Fprintf(w, "error fetching destination: %v", err)
	}
}

// TODO: make sure robots.txt doesn't follow /go/*
func static(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "jpco.io is your one-stop-shop for input and also output")
}

func cert(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "1914EEpYxXJzea3KgLPgO_qBNMFV6OkSPO_P2JP4n0g.VZPROWUd-G8vVEpgbFjwam8DmnO1dGY5obMvx5MCyuY")
}

func init() {
	http.HandleFunc("/blog/", blog)

	http.HandleFunc("/go/update", gotoUpdate)
	http.HandleFunc("/go/", gotoService)

	http.HandleFunc("/", static)
	http.HandleFunc("/.well-known/acme-challenge/1914EEpYxXJzea3KgLPgO_qBNMFV6OkSPO_P2JP4n0g", cert)
}
