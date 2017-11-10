package jpcowww

import (
	"fmt"
	"net/http"
)

const rollTmpl = `<html>
	<head>
		<meta charset="utf-8" />
		<title>roll</title>
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta http-equiv="X-UA-Compatible" content="IE=edge" />

		<script src="/js/roll.js"></script>
		<link rel="stylesheet" href="/css/roll.css" />
	</head>
	<body>
		<div id="outerer"><div id="outer">
			<div id="content">
				<div id="r-div">
					<input type="text" id="r" autofocus />
				</div>
				<div id="w-div">
					<span id="w"></span>
				</div>
			</div>
		</div></div>
	</body>
</html>`

// TODO non-browser requests?
func roll(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, rollTmpl)
}

func init() {
	http.HandleFunc("/x/roll", roll)
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "")
	})
}
