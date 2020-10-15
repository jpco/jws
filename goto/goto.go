package main

import (
    "database/sql"
    "errors"
	"fmt"
    "log"
	"net/http"
	"os"
    "encoding/pem"
    "crypto/rsa"
    "crypto/x509"
    "time"
    "encoding/json"
    "io/ioutil"
    "regexp"
    "strconv"

    "golang.org/x/oauth2/jws"

    _ "github.com/GoogleCloudPlatform/cloudsql-proxy/proxy/dialers/mysql"
)

const (
    clientID = "575814038185-fkrstudir32o62nkihtpdqjeitraqvr0.apps.googleusercontent.com"
    jpcoID = "107317223199272480198"
)

var (
    cacheControlRE = regexp.MustCompile(`max-age=(\d+)`)
    certKeys map[*rsa.PublicKey]time.Time
    db *sql.DB
    sessions = make(map[string]session)
    cachedDests = make(map[string]string)
)

func certKey(raw string) (*rsa.PublicKey, error) {
    block, _ := pem.Decode([]byte(raw))
    if block == nil {
        return nil, errors.New("nil PEM block")
    }
    cert, err := x509.ParseCertificate(block.Bytes)
    if err != nil {
        return nil, fmt.Errorf("parsing cert: %w", err)
    }
    key, ok := cert.PublicKey.(*rsa.PublicKey)
    if !ok {
        return nil, errors.New("key not RSA")
    }
    return key, nil
}

func fetchCertKeys() error {
    ok := len(certKeys) > 0
    for _, t := range certKeys {
        if time.Since(t) > 0 {
            ok = false
            break
        }
    }
    if ok {
        return nil
    }

    certKeys = make(map[*rsa.PublicKey]time.Time)
    var hc http.Client
    resp, err := hc.Get("https://www.googleapis.com/oauth2/v1/certs")
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    body, err := ioutil.ReadAll(resp.Body)
    if err != nil {
        return fmt.Errorf("reading from google certs response: %w", err)
    }

    var exp time.Time
    if m := cacheControlRE.FindStringSubmatch(resp.Header.Get("Cache-Control")); m != nil && len(m) > 0 {
        i, err := strconv.Atoi(m[1])
        if err == nil {
            exp = time.Now().Add(time.Duration(i) * time.Second)
        } else {
            log.Printf("strconv.Atoi failed: %s", err)
        }
    }

    var raws map[string]string
    if err := json.Unmarshal(body, &raws); err != nil {
        return fmt.Errorf("unmarshalling: %w", err)
    }
    for _, r := range raws {
        key, err := certKey(r)
        if err != nil {
            return fmt.Errorf("processing cert key: %w", err)
        }
        certKeys[key] = exp
    }
    log.Printf("Fetched %d cert public keys, expiring at %s", len(certKeys), exp)
    return nil
}

func validateWithAllCerts(token string) error {
    var err error
    for key := range certKeys {
        if err = jws.Verify(token, key); err == nil {
            return nil
        }
    }
    return err
}

type session struct {
    userID string
}

func fetchSession(r *http.Request) (map[string]string, error) {
    body, err := ioutil.ReadAll(r.Body)
    if err != nil {
        return nil, err
    }
    var ss map[string]string
    if err := json.Unmarshal(body, &ss); err != nil {
        return nil, fmt.Errorf("unmarshalling %q: %v", body, err)
    }
    token, ok := ss["token"]
    if !ok {
        return ss, errors.New("no id token")
    }

    if _, ok := sessions[token]; ok {
        return ss, nil
    }

    if err := fetchCertKeys(); err != nil {
        return ss, err
    }

    if err := validateWithAllCerts(token); err != nil {
        return ss, err
    }

    cs, err := jws.Decode(token)
    if err != nil {
        return ss, err
    }

    if cs.Aud != clientID {
        return ss, errors.New("Invalid API client")
    }

    if cs.Sub != jpcoID {
        return ss, errors.New("You are not the guy!")
    }

    s := session{
        userID: cs.Sub,
    }
    sessions[token] = s

    return ss, nil
}

func setSQL() error {
	conn := os.Getenv("CLOUDSQL_CONNECTION_NAME")
	user := os.Getenv("CLOUDSQL_USER")
	pass := os.Getenv("CLOUDSQL_PASSWORD")

    d, err := sql.Open("mysql", fmt.Sprintf("%s:%s@cloudsql(%s)/goto", user, pass, conn))
    if err != nil {
        return err
    }
    db = d
    return nil
}

func getLinks(w http.ResponseWriter) {
    rows, err := db.Query("SELECT src, dest FROM goto")
    if err != nil {
        w.WriteHeader(http.StatusInternalServerError)
        fmt.Fprintf(w, "querying links: %s", err)
        return
    }
    defer rows.Close()
    for rows.Next() {
        var (
            src string
            dest string
        )
        if err := rows.Scan(&src, &dest); err != nil {
            w.WriteHeader(http.StatusInternalServerError)
            fmt.Fprintf(w, "scanning DB row: %s", err)
            return
        }
        cachedDests[src] = dest
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(cachedDests)
}

func apiUpdate(w http.ResponseWriter, r *http.Request) {
    values, err := fetchSession(r)
    if err != nil {
        w.WriteHeader(http.StatusInternalServerError)
        fmt.Fprintf(w, "ARGH %s", err)
        return
    }
    src := values["src"]
    dest := values["dest"]

    if src == "" {
        w.WriteHeader(http.StatusBadRequest)
        fmt.Fprintf(w, "Source cannot be empty")
        return
    }

    cachedDests[src] = dest

    if dest == "" {
        delete(cachedDests, src)
        if _, err := db.Exec(`DELETE FROM goto WHERE SRC = ?`, src); err != nil {
            w.WriteHeader(http.StatusInternalServerError)
            fmt.Fprintf(w, "ARGH %s", err)
            return
        }
    } else {
        if _, err := db.Exec(`INSERT INTO goto (src, dest) VALUES (?, ?)
                              ON DUPLICATE KEY UPDATE src = VALUES(src),
                                 dest = VALUES(dest)`, src, dest); err != nil {
            w.WriteHeader(http.StatusInternalServerError)
            fmt.Fprintf(w, "ARGH %s", err)
            return
        }
    }

    getLinks(w)
}

func apiLinks(w http.ResponseWriter, r *http.Request) {
    _, err := fetchSession(r)
    if err != nil {
        w.WriteHeader(http.StatusInternalServerError)
        fmt.Fprintf(w, "ARGH %s", err)
        return
    }
    getLinks(w)
}

func apiBase(w http.ResponseWriter, r *http.Request) {
    _, err := fetchSession(r)
    if err != nil {
        w.WriteHeader(http.StatusInternalServerError)
        fmt.Fprintf(w, "ARGH %s", err)
        return
    }
    w.WriteHeader(http.StatusNotFound)
    fmt.Fprintf(w, "API endpoint not found")
}

type notFound string
func (f notFound) Error() string {
    return fmt.Sprintf("path %q not found", string(f))
}

func fetchRedirect(src string) (string, error) {
    if dest, ok := cachedDests[src]; ok {
        return dest, nil
    }

    var dest string
    err := db.QueryRow("SELECT dest FROM goto WHERE src = ?", src).Scan(&dest)
    if err == sql.ErrNoRows {
        return "", notFound(src)
    } else if err != nil {
        return "", fmt.Errorf("fetching destination from database: %w", err)
    }

    cachedDests[src] = dest
    return dest, nil
}

func redirect(w http.ResponseWriter, r *http.Request) {
    src := r.URL.Path[1:]
    if src == "" {
        w.WriteHeader(http.StatusBadRequest)
        fmt.Fprint(w, "How did you get here?")
        return
    }

    dest, err := fetchRedirect(src)
    if err != nil {
        switch err.(type) {
        case notFound:
            w.WriteHeader(http.StatusNotFound)
        default:
            w.WriteHeader(http.StatusInternalServerError)
        }
        fmt.Fprintf(w, "%s", err)
        return
    }

    w.Header().Set("Location", dest)
    w.Header().Set("Content-Type", "text/html; charset=utf-8")
    w.WriteHeader(http.StatusFound)
    fmt.Fprintf(w, "Headed to <a href='%s'>%q</a>", dest, dest)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

    if err := setSQL(); err != nil {
        log.Fatalf("Could not connect to database: %s", err)
    }

    http.HandleFunc("/_api/update", apiUpdate);
    http.HandleFunc("/_api/links", apiLinks)
    http.HandleFunc("/_api/", apiBase)
    http.HandleFunc("/", redirect)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), nil))
}
