<; cat tmpl/header.html >

<title>jpco.io | Es and the environment</title>
<meta name=description content="REPLACE ME">

<; build-nav >

<main>
<h1><i>Es</i> and the environment</h1>
<div class=time><time datetime=REPLACEME>REPLACEME</time></div>

<p>
Right now <i>es</i> automatically imports stuff from the environment and automatically exports stuff to the environment.

<p>
The only ways to control these behaviors are the <code>-p</code> flag and the <code>noexport</code> variable, respectively.

<p>
That&rsquo;s not exactly compelling, especially because <i>es</i> makes use of a less-than-typical set of conventions around the environment, which users sure might want to change to look more like what they&rsquo;re used to.

<p>
Moreover, for any non-shell use case of <i>es</i> (and some shell-related use cases), it is more sensible to have a less free attitude around interaction with the environment.
Better control over the shell&rsquo;s extensibility is a virtue.

<h2>Reading from the environment</h2>

<p>
Pretty much all of shell startup is hard-coded at the moment, including importing from the environment, so something like a <code>%main</code> hook function is necessary to start talking about this.

<p>
Interestingly, the way importing from the environment works is the most obviously deficient part of my es-main branch.
It would be much better if users had the ability to (1) iterate through the set of variable names in the environment, and (2) look up each environment variable&rsquo;s value.

<p>
Then startup would look something like:

<figure>
<pre>
<code>for (v = &lt;=$&amp;environment)
	if {!$p-flag || !~ $v fn-*} {
		$v = &lt;={$&amp;getenv $v}
	}</code>
</pre>
</figure>

<p>
You also have to be careful about settor functions; it is good to avoid calling those while initially importing the environment, but then after an initial set of values exist, look for settor functions for any imported variables and call them.
So that might be like:

<figure>
<pre>
<code>let (settors = (); imported = ()) {
	for (v = &lt;=$&amp;environment) {
		if {!$p-flag || {!~ $v fn-* &amp;&amp; !~ $v set-*}} {
			$v = &lt;={$&amp;getenv $v}
			imported = $imported $v
		}
	}
	if {!$p-flag} {
		for (s = $settors) {
			set-$s = &lt;={$&amp;getenv $(set-$s)}
			if {~ $s $imported} {
				$s = $$s
			}
		}
	}
}</code>
</pre>
</figure>

<p>
But that depends in part on if <code>%set</code> becomes a thing.
This also might be wrong for imported variables that have internal settors (e.g., <code>$HOME</code>).
So maybe it&rsquo;s a requirement for <code>%set</code> to exist in order to have sufficient control over all this at startup.


<h2>Writing to the environment</h2>

<p>
A <code>%set</code> hook function is necessary, first of all, to de-hardcode how <i>es</i> writes variables to the environment.

<p>
But also, <i>es</i>&rsquo; current model for interacting with the environment, internally, is not especially conducive to a simple <code>$&amp;setenv</code> primitive.
The internal design (and this is shared with many shells; I think it&rsquo;s an efficiency thing) is more like an <code>$&amp;export var</code> command which sets an &ldquo;exported&rdquo; bit for <code>var</code>; then, when a new environment vector is generated to prepare for an <code>execve()</code>, those &ldquo;exported&rdquo; bits are used to generate a new environment.

<p>
Internal variables and <code>noexport</code> variables are not exported.
The external environment is reused unless <code>isdirty</code> is true, which happens whenever the value of an exported variable is changed.
A variable&rsquo;s string representation for the environment is actually also cached and reused as long as the <code>rebound</code> variable is false, and <code>rebound</code> gets set to true whenever a lexically bound variable is given a new value (presumably because it can impact the string representation of other variables which have the same lexical scope).

<p>
So all these bits of state need to be considered if we were to separate out the core variable logic from the environment logic.
A <code>setenv</code> primitive could work by having a generated environment and a chain of updated variable values; <code>isdirty</code> would then be represented by an update chain of length 0.
Moving <code>rebound</code> out of the core shell&rsquo;s variable handling is probably impossible, but it could just be made into an internal API sort of thing.


<h2>Considerations</h2>

<p>
Does it make more sense to wait for first-class environments, à la Scheme, and just using that as the model for &ldquo;the environment&rdquo;?
That feels a little like waiting for first-class continuations just to add job control, and it might be undesirable to load up the whole environment into a single huge, special variable, rather than using primitives to load up bits and pieces on demand.

<p>
It&rsquo;s not obvious to me whether there is any utility in making a <code>$&amp;setenv</code> capable of setting environment variables to values that differ from their internally visible value.
Is that useful, or a path toward madness?


</main>
