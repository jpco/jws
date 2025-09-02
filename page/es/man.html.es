<; cat tmpl/header.html >

<title>jpco.io | es(1)</title>

<; . script/build-nav.es /es/man.html >

<main>
<p>
This is the <code>man</code> page for the installed version of <i>es</i> on this machine.

<!-- pre-wrap, --nh and --nj all help the output look nicer on smaller screens -->
<pre style="white-space: pre-wrap;">
<; local (COLUMNS = 100) man --nh --nj -E ascii es >
</pre>
