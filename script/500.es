#!/usr/local/bin/es

cat tmpl/header.html
echo '<title>jpco.io | Internal server error</title>'
. script/build-nav.es
echo (
	'<main>'
	'<p>'
	'An unhandled exception has been raised.'
	'<ul>'
	'<li>Exception type: <code>'$1'</code>'
)
if {~ $1 error} {
	echo '<li>Source: <code>'$2'</code>'
	echo '<li>Message: <code>'$3'</code>'
} {
	echo '<li>Message: <code>'^<={%flatten ' ' $*(2 ...)}^'</code>'
}
echo '</ul>'
echo '</details>'
echo '<marquee>Oh&nbsp;nooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo!&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo!</marquee>'
