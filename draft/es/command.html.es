<; cat tmpl/header.html >

<title>jpco.io | The life of an es command</title>
<meta name=description content="This page documents how a command in the extensible shell es goes from parsing to execution.">

<; build-nav /es/command.html >

<main>
<h1>The life of an <i>es</i> command</h1>
<div class=time><time datetime=REPLACEME>REPLACEME</time></div>

<p>
Like other Unix shells (and, really, any programming language), <i>es</i> commands go through a number of phases as they run, and understanding these phases is key to having a deep understanding of how the shell works as a whole.

<p>
Fortunately, there are fewer phases in <i>es</i> than some other shells, but we are going to go quite in depth here (including some discussion of shell internals).

<p>
Most commands in <i>es</i> are something of the form

<figure>
<pre>
<code>; command arg arg arg</code>
</pre>
</figure>

<p>
The basic steps:

<ol>
<li><code>%parse</code> and <code>%dispatch</code>
<li>Glomming
<li>Evaluation
	<ol>
	<li>Tree-style commands
	<li>Functions
	<li>Binaries
	</ol>
</ol>

</main>
