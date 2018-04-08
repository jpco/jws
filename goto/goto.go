package jpcowww

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strings"

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

func scanAllLinks(db *sql.DB) error {
	if db == nil {
		var err error
		db, err = sqlOpen()
		if err != nil {
			return fmt.Errorf("error opening db connection: %v", err)
		}
	}

	rows, err := db.Query("SELECT src, dest FROM goto")
	if err != nil {
		return fmt.Errorf("error querying all src => dests: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			src  string
			dest string
		)
		if err := rows.Scan(&src, &dest); err != nil {
			return fmt.Errorf("error scanning DB row: %v", err)
		}
		gotoDests[src] = dest
	}
	return nil
}

// We're apparently just going whole-hog on the whole tree structure thing now
type link struct {
	dest     string
	children map[string]*link
}

func (l *link) Fprint(w http.ResponseWriter, prefix, nm string) {
	var singles []string
	var tuples []string
	for s, c := range l.children {
		if c.children != nil {
			tuples = append(tuples, s)
		} else {
			singles = append(singles, s)
		}
	}

	if l.dest != "" {
		if prefix != "" {
			fmt.Fprintf(w, "%s / <a href='%s/%s'>%s</a>: %s<br />\n",
				prefix, prefix, nm, nm, l.dest)
		} else {
			fmt.Fprintf(w, "<a href='%s'>%s</a>: %s<br />\n", nm, nm, l.dest)
		}
		if len(singles) > 0 || len(tuples) > 0 {
			fmt.Fprint(w, "<br />\n")
		}
	}

	nprefix := nm
	if prefix != "" {
		nprefix = fmt.Sprintf("%s/%s", prefix, nm)
	}

	sort.Strings(singles)
	for _, s := range singles {
		l.children[s].Fprint(w, nprefix, s)
	}

	sort.Strings(tuples)
	for i, s := range tuples {
		if i != 0 || len(singles) != 0 {
			fmt.Fprint(w, "<br />\n\n")
		}
		l.children[s].Fprint(w, nprefix, s)
	}
}

func listSrcsDests(w http.ResponseWriter, db *sql.DB) {
	if err := scanAllLinks(db); err != nil {
		fmt.Fprint(w, err)
		return
	}

	var short []string
	links := make(map[string]*link)
	for s, d := range gotoDests {
		if !strings.HasPrefix(d, "http://") && !strings.HasPrefix(d, "https://") {
			short = append(short, s)
			continue
		}

		var cl *link
		for _, t := range strings.Split(s, "/") {
			ls := links
			if cl != nil {
				if cl.children == nil {
					cl.children = make(map[string]*link)
				}
				ls = cl.children
			}
			if _, ok := ls[t]; !ok {
				ls[t] = new(link)
			}
			cl = ls[t]
		}
		cl.dest = d
	}

	sort.Strings(short)
	for _, s := range short {
		fmt.Fprintf(w, "<a href='/%s'>%s</a>: %s<br />\n", s, s, gotoDests[s])
	}
	fmt.Fprint(w, "<br />\n\n")

	root := link{children: links}
	root.Fprint(w, "", "")
}

func gotoUpdate(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		// FIXME this should return a 500
		fmt.Fprintf(w, "error (1) %v", err)
		return
	}
	db, err := sqlOpen()
	if err != nil {
		// FIXME this should also return a 500
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
					// FIXME this should return a 500
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
					// FIXME this should return a 500
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

func init() {
	http.HandleFunc("/update", gotoUpdate)
	http.HandleFunc("/", gotoService)
}
