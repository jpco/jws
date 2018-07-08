package jpcowww

import (
	"fmt"
	"net/http"
	"os"

	"github.com/ChimeraCoder/anaconda"
	"google.golang.org/appengine"
	"google.golang.org/appengine/urlfetch"
)

type tweetGetter func() (string, error)

type noTweet struct{}

func (noTweet) Error() string {
    return "no tweet"
}

func tweet(getTweet tweetGetter) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		accessToken := os.Getenv("TWITTER_ACCESS_TOKEN")
		accessSecret := os.Getenv("TWITTER_ACCESS_TOKEN_SECRET")
		apiToken := os.Getenv("TWITTER_API_KEY")
		apiSecret := os.Getenv("TWITTER_API_SECRET")

		api := anaconda.NewTwitterApiWithCredentials(accessToken, accessSecret, apiToken, apiSecret)
		c := appengine.NewContext(r)
		api.HttpClient.Transport = &urlfetch.Transport{Context: c}

		tw, err := getTweet()
		if err != nil {
            if _, ok := err.(noTweet); ok {
                fmt.Fprint(w, "no tweet today")
                return
            }
            w.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintf(w, "error: %v", err)
		}

		if _, err := api.PostTweet(fmt.Sprintf("> %s", tw), nil); err != nil {
            w.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintf(w, "error: %v", err)
		} else {
			fmt.Fprint(w, "ok")
		}
	}
}

