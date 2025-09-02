#!/usr/local/bin/es

# Script to print the top nav bar on a page based on the path passed to it.

echo -n '<nav><pre>http://<a href=/>jpco.io</a>'
let (accum = '')
for (f = <={%split / $*}) {
	accum = $accum^/^$^f
	echo -n '/<a href="'^$accum^'">'^$^f^'</a>'
}
echo '</pre></nav>'
