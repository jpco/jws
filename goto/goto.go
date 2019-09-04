package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"

	"github.com/jpco/jws/goto/httpresp"

	_ "github.com/GoogleCloudPlatform/cloudsql-proxy/proxy/dialers/mysql"
)

var gotoDests = map[string]string{}

func sqlOpen() (*sql.DB, error) {
	conn := os.Getenv("CLOUDSQL_CONNECTION_NAME")
	user := os.Getenv("CLOUDSQL_USER")
	pass := os.Getenv("CLOUDSQL_PASSWORD")

	log.Printf("Connecting to %s:PASSWORD@cloudsql(%s)/goto", user, conn)

	return sql.Open("mysql", fmt.Sprintf("%s:%s@cloudsql(%s)/goto", user, pass, conn))
}

func scanAllLinks(db *sql.DB) error {
	if db == nil {
		var err error
		db, err = sqlOpen()
		if err != nil {
			return fmt.Errorf("opening db connection: %v", err)
		}
	}

	rows, err := db.Query("SELECT src, dest FROM goto")
	if err != nil {
		return fmt.Errorf("querying all src => dests: %v", err)
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

func (l *link) Write(prefix, nm string) *httpresp.Response {
	var singles []string
	var tuples []string
	for s, c := range l.children {
		if c.children != nil {
			tuples = append(tuples, s)
		} else {
			singles = append(singles, s)
		}
	}
	var resp *httpresp.Response

	if l.dest != "" {
		if prefix != "" {
			resp = httpresp.Format("%s / <a href='%s/%s'>%s</a>: %s",
				prefix, prefix, nm, nm, l.dest)
		} else {
			resp = httpresp.Format("<a href='%s'>%s</a>: %s", nm, nm, l.dest)
		}
		if len(singles) > 0 || len(tuples) > 0 {
			resp = resp.AddNL()
		}
	}

	nprefix := nm
	if prefix != "" {
		nprefix = fmt.Sprintf("%s/%s", prefix, nm)
	}

	sort.Strings(singles)
	for _, s := range singles {
		resp = resp.Join(l.children[s].Write(nprefix, s))
	}

	sort.Strings(tuples)
	for i, s := range tuples {
		if i != 0 || len(singles) != 0 {
			resp = resp.AddNL()
		}
		resp = resp.Join(l.children[s].Write(nprefix, s))
	}
	return resp
}

func listSrcsDests(db *sql.DB) (*httpresp.Response, *httpresp.Error) {
	if err := scanAllLinks(db); err != nil {
		return nil, httpresp.NewError(http.StatusInternalServerError, err)
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
	var resp *httpresp.Response
	for _, s := range short {
		resp = resp.Appendf("<a href='/%s'>%s</a>: %s", s, s, gotoDests[s])
	}
	resp = resp.AddNL()

	root := link{children: links}
	return resp.Join(root.Write("", "")), nil
}

func getRedirect(path string) (string, *httpresp.Error) {
	if dest, ok := gotoDests[path]; ok {
		return dest, nil
	}

	db, err := sqlOpen()
	if err != nil {
		return "", httpresp.NewError(http.StatusInternalServerError, err)
	}
	defer db.Close()

	var dest string
	err = db.QueryRow("SELECT dest FROM goto WHERE src = ?", path).Scan(&dest)
	if err == sql.ErrNoRows {
		return "", httpresp.Errorf(http.StatusNotFound, "no destination found for %q", path)
	} else if err != nil {
		return "", httpresp.Errorf(http.StatusInternalServerError,
			"fetching destination: %v", err)
	}

	gotoDests[path] = dest
	return dest, nil
}

func setLink(db *sql.DB, key, val string) (*httpresp.Response, *httpresp.Error) {
	if val == "" {
		delete(gotoDests, key)
		if _, err := db.Exec(`DELETE FROM goto WHERE SRC = ?`, key); err != nil {
			return nil, httpresp.Errorf(http.StatusInternalServerError, "unsetting %q: %v", key, err)
		}
		return httpresp.Format("unset %s", key), nil
	}

	gotoDests[key] = val
	_, err := db.Exec(`INSERT INTO goto (src, dest) VALUES (?, ?)
                       ON DUPLICATE KEY UPDATE src = VALUES(src),
                         dest = VALUES(dest),
                         exp = VALUES(exp)`, key, val)
	if err != nil {
		return nil, httpresp.Errorf(http.StatusInternalServerError, "setting %q = %q: %s", key, val, err)
	}
	return httpresp.Format("set <a href='/%s'>%s</a> to go to <a href='%s'>%s</a>", key, key, val, val), nil
}

func updateHandler(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		httpresp.NewError(http.StatusBadRequest, err).Write(w)
		return
	}

	db, err := sqlOpen()
	if err != nil {
		httpresp.NewError(http.StatusInternalServerError, err).Write(w)
		return
	}
	defer db.Close()

	var resp *httpresp.Response
	for key, vr := range r.Form {
		for _, val := range vr {
			re, err := setLink(db, key, val)
			if err != nil {
				err.Write(w)
				return
			}
			resp = resp.Join(re)
		}
	}

	re, er := listSrcsDests(db)
	if er != nil {
		er.Write(w)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	resp.AddNL().Join(re).Write(w)
}

func gotoHandler(w http.ResponseWriter, r *http.Request) {
	src := r.URL.Path[1:]
	if src == "" {
		resp, err := listSrcsDests(nil)
		if err != nil {
			err.Write(w)
		} else {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			resp.Write(w)
		}
		return
	}

	dest, err := getRedirect(src)
	if err != nil {
		err.Write(w)
		return
	}

	w.Header().Set("Location", dest)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusFound)
	httpresp.Format("headed to <a href='%s'>%q</a>", dest, dest).Write(w)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
		log.Printf("Defaulting to port %s", port)
	}

	http.HandleFunc("/update", updateHandler)
	http.HandleFunc("/", gotoHandler)

	log.Printf("Listening on port %s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), nil))
}
