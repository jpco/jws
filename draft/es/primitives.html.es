<; cat tmpl/header.html >

<title>jpco.io | Thoughts for pluggable es primitives</title>
<meta name=description content="A sort-of-design-doc for dynamically loadable primitives in the extensible shell es" />

<; build-nav /es/primitives.html >

<main>
<h1>Thoughts for pluggable <i>es</i> primitives</h1>
<div class=time><time datetime="2025-09-18">2025-09-18</time></div>

<p>
I'm interested in adding &ldquo;pluggable&rdquo; primitives to <i>es</i>.
The actual hard part of dynamically adding code to a running binary is implemented in the POSIX.1-2001-specified functions <code>dlopen</code> and <code>dlsym</code>. Given that, the question becomes: how do we design the use of those things to actually create a &ldquo;pluggable primitives&rdquo; system in <i>es</i>?

<p>
What I am picturing looks something like this.

<p>
We'd have some kind of <code>$&amp;loadlib</code> primitive which does the actual primitive-loading.
That would be wrapped in a function like

<figure>
<pre>
<code>fn use dir {
    if {!~ $dir $primdirs} {
        $&amp;loadlib $dir/lib.so
        . $dir/script.es
        primdirs = $primdirs $dir
    }
}</code>
</pre>
</figure>

<p>
Which would allow us to do <em>something</em> like

<figure>
<pre>
<code>use /usr/local/lib/es/linux-extensions</code>
</pre>
</figure>

<p>
But this is getting a little ahead of ourselves.
<em>Why</em> would we want this in the first place?

<h2>Motivations</h2>

<p>
I'm interested in using pluggable primitives for the following:

<ol>
<li>
<p>
Additional behaviors.

<p>
There are a number of behaviors which <i>es</i> could have and doesn't, out of a desire to keep <i>es</i> minimal.
I am amenable to that.
However, different people have different behaviors they'd consider useful to have in a shell, and <i>es</i> currently aims for what is essentially a lowest-common-denominator set of features.

<p>
I think pluggable primitives would be the right way to bridge that divide.
Some functions and behaviors that could be added as optional extensions to <i>es</i>:

<ul>
<li><code>getpid(3)</code> and <code>getcwd(3)</code>
<li>TODO: Other stuff
</ul>

<p>
Some behaviors, like job control primitives or alternative input libraries, also require changes to the &ldquo;core&rdquo; shell to be possible.
Changes to the core shell will be discussed later.

<li>
<p>
Per-OS functionality.

<p>
<i>Es</i> is highly portable, and that's a very good thing.

<p>
That said, like the previous bullet point, using maximally-portable code in all cases for everything leads to lowest-common-denominator features and behaviors, as the shell is bound to the feature set of the POSIX.1-2001 specification.

<p>
With pluggable primitives, <i>es</i> could make use of non-standard and OS-specific APIs.

<p>
For example: With the right OS support, like via <a href="https://docs.freebsd.org/en/books/handbook/jails/">jails</a> or <a href="https://wiki.freebsd.org/Capsicum">capsicum</a> or <a href="https://man7.org/linux/man-pages/man2/seccomp.2.html">seccomp</a>, could the idea of a restricted shell be made actually meaningful?

<p>
What kind of <a href="https://www.haiku-os.org/blog/humdinger/2017-11-05_scripting_the_gui_with_hey/">Haiku GUI scripting</a> could be made possible, or at least more ergonomic, with built-in shell support?

<p>
There are a lot more fancy things&mdash;like a <em>lot</em> more&mdash;which are inaccessable to <i>es</i> essentially only because of the word &ldquo;portable&rdquo;, and that doesn't have to be the case.

<li>
<p>
Primitive versioning.

<p>
I also believe that pluggable primitives could be used to support active development without breaking backwards compatibility.

<p>
This would require, as its major step, migrating existing primitives and related functionality out of the shell and into a set of pluggable primitives.

</ol>

<h2>Namespacing and versioning</h2>

<h2>Changes to core <i>es</i></h2>
