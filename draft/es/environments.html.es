<; cat tmpl/header.html >

<title>jpco.io | First-class environments in es?</title>
<meta name=description content="First-class environments in es">

<; build-nav >

<main>
<h1>First-class environments in <i>es</i>?</h1>
<div class=time><time datetime=2026-05-10>2026-05-10</time></div>

<p>
Very early on in <i>es</i>&rsquo; history, a suggestion was made to add first-class environments to the shell.
To this, <a href="https://wryun.github.io/es-shell/mail-archive/msg00007.html">Paul Haahr replied</a>

<blockquote>
first class environments (or user accessible hash tables) nearly appeared
in the language, but it started feeling too little like a shell.  probably
just nearsightedness on our parts.
</blockquote>

<p>
These days, <i>es</i> still lacks a first-class key-value type that other languages call associative arrays, dictionaries, or maps.
We know that <a href="https://wryun.github.io/es-shell/mail-archive/msg00571.html">Paul intended to add first-class environments and specifically to use them as the <i>es</i> key-value type</a>.
But what would first-class environments actually look like in <i>es</i>?
How much would need to be added or changed to the shell to make them work, and what could they enable?

<p>
The kernel of the concept is this.
What if, instead of only being able to supply bindings within a <code>let</code> or other binder, we could do:

<figure>
<pre>
<code>env = (a = b)
let $env echo $a</code>
</pre>
</figure>

<p>
Let&rsquo;s explore what the follow-through of this core idea would be.


<h2>Associative arrays</h2>

<p>
First-class environments in <i>es</i> should be able to function as associative arrays.
To create one using a literal is easy.
It ought to use the same syntax for bindings that already exists in the shell today.

<figure>
<pre>
<code>headers = (host = jpco.io; accept = text/html application/xml)</code>
</pre>
</figure>

<p>
There would be two ways to access a certain value from an environment.
The first would be

<figure>
<pre>
<code>let $headers echo $host</code>
</pre>
</figure>

<p>
But, for ergonomics&rsquo; sake, subscripts should be made to work for environments as well.
This actually has slightly different semantics than the above, if <code>$headers</code> doesn&rsquo;t contain a binding for <code>host</code>.

<figure>
<pre>
<code>echo $headers(host)</code>
</pre>
</figure>

<p style="background-color: #faa;">
A list can be turned into a set of bindings like <code>($list = ())</code>.
To query what &ldquo;keys&rdquo; are bound in an environment, or to iterate through an environment, ???

<p>
There are two ways to change the environment you&rsquo;re working with.
The first, already built-in way, is

<figure>
<pre>
<code>let $headers {host = google.com}</code>
</pre>
</figure>

<p>
This modifies a binding already in the environment in-place (if the header already contains that binding).
To extend an environment to add a new binding, a bit of new syntax would be added.

<figure>
<pre>
<code>headers = ($headers; host = google.com)</code>
</pre>
</figure>

<p>
Note that this doesn&rsquo;t actually modify the original <code>headers</code> environment; it creates a new one which extends the previous one, and reassigns <code>headers</code>.
It is not actually possible to change, in-place, the set of bindings in an environment, much like it isn&rsquo;t possible to change an element of a list in-place: you have to create a new list, and you have to create a new environment.
These are real limitations, but they seem possible to work around without too much fundamental difficulty.

<p>
First-class environments do seem capable of expressing encapsulated &ldquo;objects&rdquo; in a fairly natural way.
For example:

<figure>
<pre>
<code>fn new-stack {
	let (s = ())
	result (
		fn push {s = $* $s}
		fn pop {
			let (r = ()) {
				(r s) = $s
				result $r
			}
		}
	)
}

s = &lt;=new-stack
let $s push world
let $s push hello
echo &lt;={let $s pop} &lt;={let $s pop}</code>
</pre>
</figure>

<p>
A similar thing is possible using <i>es</i>&rsquo; existing closures, but it is unintuitive, requiring a dispatch function to be defined:

<figure>
<pre>
<code>fn new-stack {
	let (s = ())
	let (
		fn push {s = $* $s}
		fn pop {
			let (r = ()) {
				(r s) = $s
				result $r
			}
		}
	)
	result @ cmd args {
		$cmd $args
	}
}

s = &lt;=new-stack
$s push world
$s push hello
echo &lt;={$s pop} &lt;={$s pop}</code>
</pre>
</figure>

<p>
Note that both of these examples would suffer from the closure-splitting problem present in <i>es</i> today; first-class environments don&rsquo;t by themselves solve that problem.
However, they do potentially help with it.


<h2>Externalization</h2>

<p>
Let&rsquo;s look at a simple, classic example of closure-splitting.

<figure>
<pre>
<code>let (state = hello world) {
	fn morning {echo $state; state = goodnight moon}
	fn night {echo $state; state = hello world}
}
echo $fn-morning</code>
</pre>
</figure>

<p>
Here we have two functions, <code>morning</code> and <code>night</code>, sharing a lexical binding of <code>state</code>.
When dumping the shell&rsquo;s state to the environment, these two lexical bindings should remain shared.
Let&rsquo;s suppose the shell does the right thing with that&mdash;presumably, through some kind of tagging mechanism.
In that case, what does <code>echo $fn-morning</code> print?

<p>
There are a few options here.
One is that the stringification of <code>$fn-morning</code> somehow &ldquo;closes over&rdquo; the entire lexical scope, such that it includes the definition of <code>$fn-night</code>.
This may work, but would probably need to be specially deduplicated in some way when exporting the environment, to avoid a lot of unnecessary code.
It would also need some kind of special handling on the reading side, and has some open questions as far as how to import, for example, <code>fn-morning</code>, and then later to import <code>fn-night</code>, especially if any of <code>fn-morning</code>, <code>fn-night</code>, or <code>state</code> have changed in the meantime.

<p>
A second option would be to attempt to opportunistically create a tag for the lexical scope of <code>$fn-morning</code> right away, preparing for the eventuality that <code>$fn-night</code> might be printed later.
Because <code>$fn-night</code> could be printed at an arbitrarily later time, tags would need to be stable, either being consistently derivable from some existing feature of their bindings, or produced and saved alongside the existing state.
This creates an entire new scope of object lifetimes, new strings to produce (with global uniqueness requirements!) and compare, and a large number of useless tag strings cluttering the environment.

<p>
The third option, and the most straightforward by far, would be to make use of first-class environments to explicitly delimit the boundaries of a closure tagging scope.
First-class environments give <i>es</i> a built-in way to express &ldquo;stringify the following <em>group</em> of bindings, all together&rdquo;, such that the runtime doesn&rsquo;t need to worry about any other bindings.
This would simplify tagging, as the scope for tags would be bounded, unique, and the entire environment would be present all at once.
It would have some sharp corners&mdash;<code>echo $fn-morning; echo $fn-night</code> would still be broken, but the bug would be reasonably easy to explain, and (it is my expectation that) this would be less frequent in practice than ways to do the same thing using environments.
Lastly: This would make it so that the behavior around exporting the shell&rsquo;s state into the Unix environment can become a special case of a more general mechanism.
More on that later.


<h2>Environment application and extraction</h2>

<p>
The bulk of what has been described thus far around environments make them, basically, look like awkward associative arrays.
However, first-class environments are significantly more powerful than this when properly integrated into the runtime.
In fact, many of the historical designs for first-class environments don&rsquo;t include a way to specify an environment literal at all!

<p>
The unique power of first-class environments comes from the ability to apply them to, or extract them from, the current scope (what Queinnec and Roure call &ldquo;import&rdquo; and &ldquo;export&rdquo;, respectively).
We have already seen how an environment can be used to extend the current lexical scope, using <code>let</code>.

<p>
In addition to this, we can apply an environment to the existing bindings in our scope with assignment.
This is near-identical to existing assignment statements, and it would not be unreasonable to make it so that assignments are simple syntactic sugar for environment application:

<figure>
<pre>
<code>; a = b
; (a = b)</code>
</pre>
</figure>


<h2>Relationship with extensible primitives</h2>


<h2>Loose ends</h2>

<p>
There are a lot of constructs that could, syntactically, contain first-class environments for which the semantics aren&rsquo;t clear.

<figure>
<pre>
<samp>; </samp><kbd>(a = b) echo $a</kbd>
<samp>; </samp><kbd>echo $a^(a = b)</kbd>
<samp>; </samp><kbd>echo (a = b)^(c = d)</kbd>
<samp>; </samp><kbd>echo $(a = b)</kbd>
<samp>; </samp><kbd>(a = b) = hello world</kbd>
</pre>
</figure>


</main>
