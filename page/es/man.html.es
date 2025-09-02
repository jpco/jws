<; cat tmpl/header.html >

<title>jpco.io | es(1)</title>

<; . script/build-nav.es /es/man.html >

<main>
<p class=noprint>
This is the <code>man</code> page for the installed version of <i>es</i> on this server.

<!-- pre-wrap, --nh and --nj all help the raw output look ok on smaller screens -->
<pre style="margin: auto; width: fit-content; white-space: pre-wrap;">
<; local (COLUMNS = 90) man --nh --nj es >
</pre>
