<; cat tmpl/header.html >

<title>jpco.io | es(1)</title>
<meta name=description content="The man page for es, the extensible shell.">

<; build-nav /es/man.html >

<main>
<p class=noprint>
This is the <code>man</code> page for the installed version of <i>es</i> on this server.

<!-- pre-wrap, --nh and --nj all help the raw output look ok on smaller screens -->
<!-- TODO: make the request for man after the fact so we can measure browser COLUMNS? -->

<pre id=main-block>
<; local (COLUMNS = 90) man --nh --nj es | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' >
</pre>
</main>
