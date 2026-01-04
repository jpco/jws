<; cat tmpl/header.html >

<title>jpco.io | Exceptions in the extensible shell</title>
<meta name=description content="This page explores the use of the exception mechanism in the extensible shell es">

<; build-nav /es/exceptions.html >

<main>
<h1>The <del>Extensible</del><ins>Exceptional</ins> Shell</h1>
<div class=time><time datetime="2025-09-11">TODO</time></div>

<p>
<i>Es</i> is the exceptional shell.

<p>
That is, <i>es</i> features and heavily relies on its exception mechanism for a number of uses.

<p>
When I first happened upon <i>es</i>, I thought the idea of an exception mechanism in a shell seemed &ldquo;heavy-weight&rdquo; and strange.
Now I think it is a major asset in the shell, allowing for a few simple mechanisms to handle essentially any event which can interrupt normal execution.

<p>
The simplest exception in <i>es</i> is the <code>eof</code> exception.
It's raised by the <code>%parse</code> function when it has reached the end of its input, in order to break out of the loop function processing that input.
<code>eof</code> carries no data with it&mdash;it is a single bit signaling that input is over.
Because it is an exception, a loop function can simply <code>catch</code> it, and no special mechanisms are necessary in the shell for handling an end-of-file condition.

<p>
Throwing exceptions in <i>es</i> is done with the <code>throw</code> function, or as part of built-ins like <code>%parse</code> or anything which happens to throw an <code>error</code>.
Catching them is done with the <code>catch</code> function, which takes as arguments a <em>catcher</em> and a <em>body</em>.
The body is evaluated and if an exception is thrown then the catcher is evaluated with that exception as its arguments.

<p>
Depending on its type, an exception often carries with it information of some kind, passed to the catcher as the remaining arguments after the exception type.

<figure class=centered>
<pre>
<code>let (result = ())
catch @ e rest {
    if {~ $e eof} {
        result $result
    } {
        throw retry
    }
} {
    forever {
        let (code = &lt;=%parse)
	if {!~ $#code 0} {
	    result = &lt;=$code
	}
    }
}</code>
</pre>
<figcaption>A simple read-eval-print loop which handles the <code>eof</code> exception.</figcaption>
</figure>

<p>
In addition to raw <code>catch</code>, <i>es</i> has an <code>unwind-protect</code> function, which, thanks to the uniformity of exceptions, can clean up state after nearly any interruption (of course, there's nothing <i>es</i> can do about a <code>SIGKILL</code>).

<figure>
<pre>
<code>let (file = `mktemp)
unwind-protect {
    # no matter what act-on does ...
    act-on $file
} {
    # ... this rm is nearly guaranteed to run
    rm -f $file
}</code>
</pre>
</figure>

<h2>Control flow exceptions</h2>

<p>
break, retry, return

<p>
exit

<h2>The <code>signal</code> exceptions</h2>

<p>
signal

<h2>The <code>error</code> and <code>false</code> exception</h2>

<p>
error, false
