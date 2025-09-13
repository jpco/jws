<; cat tmpl/header.html >

<title>jpco.io | debug</title>
<meta name=description content="server debug page" />

<; build-nav /debug.html >

<main>

<h3>HTTP request headers</h3>

<p>
<figure>
<pre>
<; for (i = <=$&vars) if {~ $i head-*} {echo <={~~ $i head-*}^: $$i} >
</pre>
</figure>

<h3>HTTP response headers</h3>

<p>
<figure>
<!-- FIXME: how to marry this with the serve.es logic? -->
<pre>
<; respond 200 text/plain >
</pre>
</figure>

<h3>Variables</h3>

<p>
<figure>
<pre>
<; vars >
</pre>
</figure>
