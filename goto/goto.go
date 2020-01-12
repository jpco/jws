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

var (
	gotoDests = map[string]string{}
	db        *sql.DB
)

func sqlOpen() *sql.DB {
	conn := os.Getenv("CLOUDSQL_CONNECTION_NAME")
	user := os.Getenv("CLOUDSQL_USER")
	pass := os.Getenv("CLOUDSQL_PASSWORD")

	db, err := sql.Open("mysql", fmt.Sprintf("%s:%s@cloudsql(%s)/goto", user, pass, conn))
	if err != nil {
		log.Fatalf("Could not connect to database: %v", err)
	}

	log.Printf("Connected to database at %s@cloudsql(%s)/goto", user, conn)
	return db
}

func scanAllLinks() error {
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
			resp = httpresp.Format("%s / <a href='%s/%s'>%s</a><span class='dest'>: %s</span><br />",
				prefix, prefix, nm, nm, l.dest)
		} else {
			resp = httpresp.Format("<a href='%s'>%s</a><span class='dest'>: %s</span><br />", nm, nm, l.dest)
		}
		if len(singles) > 0 || len(tuples) > 0 {
			resp = resp.Append("<br />")
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
			resp = resp.Append("<br />")
		}
		resp = resp.Join(l.children[s].Write(nprefix, s))
	}
	return resp
}

func listSrcsDests() (*httpresp.Response, *httpresp.Error) {
	if err := scanAllLinks(); err != nil {
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
	resp = resp.Append("<meta name='viewport' content='width=device-width, initial-scale=1'>")
	resp = resp.Append("<style>.dest{display: none;}@media(min-width:500px){.dest{display: inline;}}</style>")

	for _, s := range short {
		resp = resp.Appendf("<a href='/%s'>%s</a><span class='dest'>: %s</span><br />", s, s, gotoDests[s])
	}
	resp = resp.Append("<br />")

	root := link{children: links}
	return resp.Join(root.Write("", "")), nil
}

func getRedirect(path string) (string, *httpresp.Error) {
	if dest, ok := gotoDests[path]; ok {
		return dest, nil
	}

	var dest string
	err := db.QueryRow("SELECT dest FROM goto WHERE src = ?", path).Scan(&dest)
	if err == sql.ErrNoRows {
		return "", httpresp.Errorf(http.StatusNotFound, "no destination found for %q", path)
	} else if err != nil {
		return "", httpresp.Errorf(http.StatusInternalServerError,
			"fetching destination: %v", err)
	}

	gotoDests[path] = dest
	return dest, nil
}

func setLink(key, val string) (*httpresp.Response, *httpresp.Error) {
	if val == "" {
		delete(gotoDests, key)
		if _, err := db.Exec(`DELETE FROM goto WHERE SRC = ?`, key); err != nil {
			return nil, httpresp.Errorf(http.StatusInternalServerError, "unsetting %q: %v", key, err)
		}
		return httpresp.Format("unset %s<br />", key), nil
	}

	gotoDests[key] = val
	_, err := db.Exec(`INSERT INTO goto (src, dest) VALUES (?, ?)
                       ON DUPLICATE KEY UPDATE src = VALUES(src),
                         dest = VALUES(dest)`, key, val)
	if err != nil {
		return nil, httpresp.Errorf(http.StatusInternalServerError, "setting %q = %q: %s", key, val, err)
	}
	return httpresp.Format("set <a href='/%s'>%s</a> to go to <a href='%s'>%s</a><br />", key, key, val, val), nil
}

func updateHandler(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		httpresp.NewError(http.StatusBadRequest, err).Write(w)
		return
	}

	var resp *httpresp.Response
	for key, vr := range r.Form {
		for _, val := range vr {
			re, err := setLink(key, val)
			if err != nil {
				err.Write(w)
				return
			}
			resp = resp.Join(re)
		}
	}

	re, er := listSrcsDests()
	if er != nil {
		er.Write(w)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	resp.Append("<br />").Join(re).Write(w)
}

func gotoHandler(w http.ResponseWriter, r *http.Request) {
	src := r.URL.Path[1:]
	if src == "" {
		resp, err := listSrcsDests()
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

	db = sqlOpen()
	defer db.Close()

	http.HandleFunc("/update", updateHandler)
	http.HandleFunc("/", gotoHandler)

	log.Printf("Listening on port %s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), nil))
}
