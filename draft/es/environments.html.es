<; cat tmpl/header.html >

<title>jpco.io | First-class environments in es?</title>
<meta name=description content="First-class environments in es">

<; build-nav >

<main>
<h1>First-class environments in <i>es</i>?</h1>
<div class=time><time datetime=2026-05-10>2026-05-10</time></div>

<p>
What would first-class environments look like in the extensible shell?
How would they interact with the shell&rsquo;s existing <code>let</code>, <code>local</code>, <code>%closure</code>, lambda, and environment mechanisms?

<h2>Lexical environments</h2>

<p>
Today, <i>es</i> lacks, and could use, a key-value store type such as a dict or map, where someone could define an environment literal.  Assuming we want to use first-class environments for that as well, there&rsquo;s little question that such a literal would look like:

<figure>
<pre>
<code>stack = (
	s = ()
	fn push {s = $* $s}
	fn pop {let (p = ()) {(p s) = $s; result $p}}
)</code>
</pre>
</figure>

<p>
Applying it lexically might look like

<figure>
<pre>
<code>let $stack {echo $s}</code>
</pre>
</figure>

<p>
or

<figure>
<pre>
<code>let $stack push foo</code>
</pre>
</figure>

<p>
which should be semantically identical (or only differ in terms of glomming scope) to

<figure>
<pre>
<code>let (
	s = ()
	fn push {s = $* $s}
	fn pop {let (p = ()) {(p s) = $s; result $p}}
) push foo</code>
</pre>
</figure>

<p>
which actually doesn&rsquo;t work as implied by the code, since <code>$s</code> is not bound in the lexical context of <code>push</code>; you&rsquo;d need two bindings for &ldquo;inner&rdquo; and &ldquo;outer&rdquo; state, or a <code>letrec</code> imitation via assignment.  A bit inconvenient, but <i>es</i> isn&rsquo;t an OO language.
A <code>letrec</code>-imitating version, including a bit of novel notation for convenience:

<figure>
<pre>
<code>let (stack = (s; fn-push; fn-pop)) {
	let $stack {
		fn push {s = $* $s}
		fn pop {let (p = ()) {(p s) = $s; result $p}}
	}
	result $stack
}</code>
</pre>
</figure>

The syntactic innovation here, other than <code>let $env</code>, is allowing <code>(a; b)</code> to indicate <code>(a =; b =)</code>.
You could potentially create an object with private members and public members like:

<figure>
<pre>
<code>let (private = (s = ()); public = (fn-push; fn-pop)) {
	let $private let $public {
		fn push {s = $* $s}
		fn pop {let (p = ()) {(p s) = $s; result $p}}
	}
	result $public
}</code>
</pre>
</figure>

<p>
(In this case you don&rsquo;t need the <code>letrec</code> imitation, since the two functions don&rsquo;t refer to each other, but if they did then you would).  In a larger-scale setting like modules, private state would be more conveniently achieved through global-scope shenanigans; more on this later.

<p>
With no additional changes, objects (like in OO) could be worked with as in the following example.

<figure>
<pre>
<code>s = &lt;=stack
let $s push world
let $s push hello
echo &lt;={let $s pop} &lt;={let $s pop}</code>
</pre>
</figure>

<p>
The <code>let</code>s here are somewhat obnoxious.

<p>
If we were to go further, <code>let</code> could be demoted to syntactic sugar, where <code>let (a = b) echo $a</code> is rewritten as <code>(a = b) {echo $a}</code> (the thunk is necessary to delay glomming).
This could make the previous example read like the following, which is much more OO-ish:

<figure>
<pre>
<code>s = &lt;=stack
$s push world
$s push hello
echo &lt;={$s pop} &lt;={$s pop}</code>
</pre>
</figure>

<p>
Note that the <code>let</code> syntax would probably still need to exist, for backwards compatibility and legibility.
Is that too confusing?
Is it too strange and risky that <code>$s push world</code> doesn&rsquo;t lexically distinguish between the <em>very</em> different behaviors depending on if <code>$s</code> is an environment or if it is the beginning of a command?

<p>
Presumably, we should also allow list-like reference syntax for environments, like:

<figure>
<pre>
<code>env = (first = one two; second = three four)
echo $env(first)</code>
</pre>
</figure>

<p>
Probably, if we wanted to use these like dicts; it would be frustrating to have to say <code>echo &lt;={let $s result $first}</code> every time.
Also, this would be more precise: <code>$s(first)</code> tells us the value of <code>first</code> in precisely the environment <code>$s</code>, while <code>let $s result $first</code> may return a value for <code>$first</code> from elsewhere, if it is not bound in <code>$s</code>.
On the other hand, we should probably <em>not</em> allow syntax like

<figure>
<pre>
<code>env(first) = five six</code>
</pre>
</figure>

<p>
even though it&rsquo;s tempting to do so.
Note that we don&rsquo;t allow this for lists like <code>li(1) = blah</code>, either.
Either both should have this syntax, or neither should, and at least today, <i>es</i> just doesn&rsquo;t have that kind of malleability in its data types, relying more on copying.
If we want to modify a binding of <code>$env</code> in-place, we can do this:

<figure>
<pre>
<code>let $env {first = five six}</code>
</pre>
</figure>

<p>
and if we want to <em>extend</em> <code>$env</code>, we can do (TODO: is this right?):

<figure>
<pre>
<code>env = ($env; first = five six)</code>
</pre>
</figure>

<p>
At the moment, it&rsquo;s unclear what the impact of all this would be on externalization.
In theory, first-class environments would provide a greater degree of freedom in externalization, but their use would almost certainly increase the urgency of fixing the existing limitations of the logic.


<h2>Dynamic environments</h2>

<p>
Exposing environments as a first-class data type in <i>es</i> strongly suggests changing how interaction works with the dynamic (top-level) environment as well.

<p>
At a very high level, here&rsquo;s how it appears the shell behaves today, using a new, first-class-environment framing: The file initial.es defines a <code>base</code> dynamic environment.
The (Unix) environment determines an <code>environment</code> dynamic environment.
Shell startup modifies the <code>environment</code> (based on the <code>-p</code> flag), and then in normal shell usage it is expected that the <code>environment</code> is &ldquo;layered&rdquo; atop the <code>base</code>.
Dynamic binding and assignments then modify <code>environment</code>, constrained by settor functions and internally filtered using <code>noexport</code>.

<p>
The challenge right now is that, while it is a core feature of <i>es</i> to allow functions like <code>%interactive-loop</code> to be changed by the environment, it is shell-breaking nonsense to allow functions like <code>%seq</code> or <code>true</code> to be changed.
Perhaps these definitions get defined and then exported into an environment, which other functions lexically bind with <code>let $core</code>, shadowing any particular dynamic value.


</main>
