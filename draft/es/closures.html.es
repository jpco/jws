<; cat tmpl/header.html >

<title>jpco.io | Fixing es&rsquo; closure splitting and looping problems</title>
<meta name=description content="A description of the 'closure looping' and 'closure splitting' bugs in es and how they have now been fixed.">

<; build-nav >

<main>
<h1>Fixing <i>es</i>&rsquo; closure splitting and looping problems</h1>
<div class=time><time datetime=2026-06-25>2026-06-25</time></div>

<p>
<i>Es</i>, being heavily influenced by Scheme, makes quite a big deal about its dedication to lexical scope.

<p>
This comes as no surprise.
While lexically scoped variables are the right choice for any language, their role in something like C is simple and relatively minimal.
It&rsquo;s when a language leans heavily on first-class functions and code fragments, like Scheme or <i>es</i> do, that lexical scope becomes critical&mdash;and much more complex.

<p>
The major concept here is the <em>closure</em>.
When a lambda expression, or code fragment, is evaluated (particularly when used as, say, a value to be assigned to a variable, passed as an argument, or returned from a function), all the variable bindings in its lexical environment are attached to it, to be carried around with it from then on.

<figure>
<pre>
<samp>; </samp><kbd># here we "close over" the {echo $a} with the binding (a = b)</kbd>
<samp>; </samp><kbd>let (a = b) echo-a = {echo $a}</kbd>
<samp>; </samp><kbd># even if we set some other value for $a outside the lexical binding...</kbd>
; </samp><kbd>a = bogus</kbd>
<samp>; </samp><kbd># ... this closure, when called, will still just see (a = b)</kbd>
<samp>; </samp><kbd>$echo-a</kbd>
b
</pre>
</figure>

<p>
Closures can be used for all sorts of purposes.
The canonical <i>es</i> example is function spoofing, where a command is extended to perform additional behavior.
For example, the following function from my own .esrc extends <code>ssh</code> to redefine the <code>TERM</code> variable if it is equal to <code>foot</code>, as many <code>terminfo(5)</code> databases lack an entry for that terminal.

<figure>
<pre>
<code>let (s = &lt;={%whatis ssh})
fn ssh {
	if {~ $TERM foot} {
		local (TERM = xterm-256color) $s $*
	} {
		$s $*
	}
}</code>
</pre>
</figure>

<p>
I won&rsquo;t spend too much space describing closures&mdash;given their widespread use, the literature on this topic is already extensive and widely available online.
The point here is just to add a little context before getting into the <i>es</i>-specific stuff.

<h2>Externalization</h2>

<p>
One of the distinct requirements of <i>es</i> is that, because its state is passed between processes through the environment and <code>argv</code> arrays, any first-class object (that is, anything which can be stored in a variable) must be externalizable as a string or a list of strings.
That is to say, anything that can be stored in <code>v</code> here:

<figure>
<pre>
<code>v = &lt;=my-function</code>
</pre>
</figure>

must also be possible to pass to a new process via its argument list like:

<figure>
<pre>
<code>./my-script.es $v</code>
</pre>
</figure>

<p>
This is something most languages don&rsquo;t bother with.
For example, Scheme simply prints an opaque identifier, which tells you nothing about the actual contents of the closure:

<figure>
<pre>
<samp>#;1&gt; </samp><kbd>(let ((a (lambda () ('a)))) (print a))</kbd>
<samp>#&lt;procedure (a)&gt;</samp>
</pre>
</figure>

<p>
This isn&rsquo;t sufficient for <i>es</i>, which needs the entire closure represented accurately enough to be able to parse and evaluate it later.
So, what we get in <i>es</i> is:

<figure>
<pre>
<samp>; </samp><kbd>let (a = b) fn x {echo $a}</kbd>
<samp>; </samp><kbd>whatis x</kbd>
<samp>%closure(a=b)@ *{echo $a}</samp>
</pre>
</figure>

<p>
This <code>%closure</code> syntax here provides a complete description of the closed-over body of <code>x</code>, sufficient to evaluate it accurately (that is, to echo <code>b</code>.)
<code>%closure</code> is a bit of a strange corner of <i>es</i>, intended to rarely be read by humans and never to be produced by them, but critical for faithfully passing closures from <i>es</i> to <i>es</i> around the system.
If we actually print the spoofed <code>ssh</code> from above, we get:

<figure>
<pre>
<code>%closure(s=/usr/bin/ssh)@ *{if {~ $TERM foot} {local(TERM=xterm-256color)$s $*} {$s $*}}</code>
</pre>
</figure>

<p>
Not exactly pretty, but the way that <code>s</code> is bound within the lambda should be clear enough.
However, things can get complicated pretty quickly, once we get multiple variables and nested bindings.
This fairly simple example

<figure>
<pre>
<code>let (a = wow)
let (b = {echo $a})
let (c = {echo $b})
fn x {echo $c}

whatis x</code>
</pre>
</figure>

<p>
Turns into the following output:

<figure>
<pre>
<code>%closure(a=wow;b='%closure(a=wow){echo $a}';c='%closure(a=wow;b=''%closure(a=wow){echo $a}''){echo $b')@ *{echo $c}</code>
</pre>
</figure>

<p>
This is much uglier.
It contains <code>%closure</code>s inside of <code>%closure</code> bindings, with nested quotation marks, and contains <code>a=wow</code> four times, where the original code only does so once.
When the definitions involved are real function bodies which spanning dozens of lines, this ugliness only compounds.
And that&rsquo;s not even the real problem!


<h2>The problem(s)</h2>

<p>
The historic representation of closures has had two major bugs, which I call &ldquo;closure splitting&rdquo; and &ldquo;closure loops&rdquo;.

<p>
Closure splitting happens when two separate function definitions share a reference to the same lexical binding.
For example, take this very-simple definition of a stack data structure.

<figure>
<pre>
<code>let (s = ()) {
	fn push {s = $* $s}
	fn pop {let ((r e) = $s) {s = $e; result $r}}
}</code>
</pre>
</figure>

<p>
In this example, the two functions <code>push</code> and <code>pop</code> both refer to the same lexically-bound <code>s</code>.
However, they&rsquo;re externalized as

<figure>
<pre>
<code>fn-push = '%closure(s=)@ *{s=$* $s}'
fn-pop = '%closure(s=)@ *{let((r e)=$s){%seq {s=$e} {result $r}}}'</code>
</pre>
</figure>

<p>
These stringified definitions don&rsquo;t indicate at all that the <code>(s=)</code> bindings should actually be treated as the <em>same</em> binding, so if these definitions are parsed by another process, <code>s</code> is &ldquo;split&rdquo; between the functions, breaking the ability to actually <code>push</code> to and <code>pop</code> from a single stack.


</main>
