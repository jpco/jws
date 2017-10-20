package jpcowww

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"sort"

	"google.golang.org/appengine"
	"google.golang.org/appengine/user"

	_ "github.com/go-sql-driver/mysql"
)

var gotoDests = map[string]string{}

func sqlOpen() (*sql.DB, error) {
	conn := os.Getenv("CLOUDSQL_CONNECTION_NAME")
	user := os.Getenv("CLOUDSQL_USER")
	pass := os.Getenv("CLOUDSQL_PASSWORD")

	return sql.Open("mysql", fmt.Sprintf("%s:%s@cloudsql(%s)/goto", user, pass, conn))
}

func listSrcsDests(w http.ResponseWriter, db *sql.DB) {
	if db == nil {
		var err error
		db, err = sqlOpen()
		if err != nil {
			fmt.Fprintf(w, "error opening db connection: %v", err)
			return
		}
	}
	rows, err := db.Query("SELECT src, dest FROM goto")
	if err != nil {
		fmt.Fprintf(w, "error querying all src => dests: %v", err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var (
			src  string
			dest string
		)
		if err := rows.Scan(&src, &dest); err != nil {
			fmt.Fprintf(w, "error scanning row: %v", err)
			break
		}
		gotoDests[src] = dest
	}
	var srcs []string
	for s := range gotoDests {
		srcs = append(srcs, s)
	}
	sort.Strings(srcs)
	for _, s := range srcs {
		fmt.Fprintf(w, "<a href='/%s'>%s</a>: %s<br />\n", s, s, gotoDests[s])
	}
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
					fmt.Fprintf(w, "unset %s<br />\n", key)
				} else {
					fmt.Fprintf(w, "error unsetting %s: %s<br />\n", key, err)
				}
			} else {
				gotoDests[key] = x
				if _, err := db.Exec(`INSERT INTO goto (src, dest) VALUES (?, ?)
									  ON DUPLICATE KEY UPDATE src = VALUES(src), 
										dest = VALUES(dest),
										exp = VALUES(exp)`, key, x); err == nil {
					fmt.Fprintf(w, "set <a href='/%s'>%s</a> to go to <a href='%s'>%s</a><br />\n", key, key, x, x)
				} else {
					fmt.Fprintf(w, "error setting %s to %s: %s<br />\n", key, x, err)
				}
			}
		}
	}
	fmt.Fprintf(w, "<br />\n\n")
	listSrcsDests(w, db)
}

func gotoService(w http.ResponseWriter, r *http.Request) {
	src := r.URL.Path[1:]
	if src == "" {
		ctx := appengine.NewContext(r)
		if user.Current(ctx) != nil {
			listSrcsDests(w, nil)
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

func cert(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "FSdYgqpToL5jkaYxneCNGIKTrrKp9lmH18k7o8CqVo8.VZPROWUd-G8vVEpgbFjwam8DmnO1dGY5obMvx5MCyuY")
}

func init() {
	http.HandleFunc("/.well-known/acme-challenge/FSdYgqpToL5jkaYxneCNGIKTrrKp9lmH18k7o8CqVo8", cert)

	http.HandleFunc("/update", gotoUpdate)
	http.HandleFunc("/", gotoService)
}
