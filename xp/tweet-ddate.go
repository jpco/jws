package jpcowww

import (
    "time"
    "math/rand"
    "fmt"
)

var holidays = map[time.Month]map[int]string{
	time.January:   {5: "Mungday"},
	time.February:  {19: "Chaoflux", 29: "St. Tib's Day"},
	time.March:     {19: "Mojoday"},
	time.May:       {3: "Discoflux", 31: "Syaday"},
    time.July:      {15: "Confuflux"},
	time.August:    {12: "Zaraday"},
	time.September: {26: "Bureflux"},
	time.October:   {24: "Maladay"},
	time.December:  {8: "Afflux"},
}

var happies = []string{
    "Happy %s, folks",
    "happy %s, everybody!",
    "happy %s people",
    "Happy %s everyone",
    "how are y'all spending your %s?",
    "%s really HAS gotten too commercial",
}

func dDateTweet() (string, error) {
    loc, err := time.LoadLocation("America/Los_Angeles")
    if err != nil {
        panic("oh no time zone didn't happen")
    }

    var holiday string
	_, m, d := time.Now().In(loc).Date()
    if m, ok := holidays[m]; ok {
        if d, ok := m[d]; ok {
            holiday = d
        }
    }
    if holiday == "" {
        return "", noTweet{}
    }

    // weird hack
    return fmt.Sprintf(happies[rand.Intn(len(happies))], holiday), nil
}
