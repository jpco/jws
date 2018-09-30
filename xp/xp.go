package jpcowww

import (
	"net/http"
)

func init() {
	http.HandleFunc("/x/cron/tweet/ddate", tweet(dDateTweet))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})
}
