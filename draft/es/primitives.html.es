<; cat tmpl/header.html >

<title>jpco.io | Thoughts for extensible es primitives</title>
<meta name=description content="A sort-of-design-doc for dynamically loadable primitives in the extensible shell es" />

<; build-nav >

<main>
<h1>Thoughts for extensible <i>es</i> primitives</h1>
<div class=time><time datetime="2025-09-18">2025-09-18</time></div>

<p>
The extensible shell <i>es</i> can be thought of has having three layers, each with different degrees of malleability.

<p>
The top layer contains everything defined in the shell: variables, functions, and so on.
Due to the nice qualities of <i>es</i>, this layer includes things like the definition of the interactive and non-interactive REPLs, control flow constructs like <code>while</code>, path-searching behavior, the <code>cd</code> builtin, and so on.
This is the &ldquo;extensible&rdquo; part of the extensible shell.

<p>
The bottom layer is the core shell runtime implementing things like the GC, data structures, variables, closures, glomming, and so on.
In general, nothing in this layer is modifiable without hacking on the runtime, since this is the foundation of the shell and needs to be kept coherent to support everything else.
This layer also tends to work outside of the abstractions available to the shell&rsquo;s language, making it infeasible to express desired behaviors using the shell language at all.
Much of what happens at this layer is invisible to the user, even, though certain isolated behaviors can be customized with hook functions, as with the <code>%home</code> hook.

<p>
The middle layer is the one of interest for this page: it is the <em>primitives</em> layer.
Primitives are the callable objects in <i>es</i> script which are implemented using C, and which, in some sense, make up the &ldquo;standard library&rdquo; of the shell.
A large proportion of the shell&rsquo;s behaviors, especially those that are relevant to its nature as a <em>shell</em>, are implemented via primitives such as <code>$&amp;pipe</code>, <code>$&amp;fork</code>, <code>$&amp;read</code>, and so on.
While the internals of a primitive are opaque, a well-designed and well-documented primitive has behavior that is understandable, predictable, and orthogonal to other primitives.

<p>
As a broad rule, improving the extensibility of <i>es</i> is a process of moving behaviors from lower layers to higher ones: exposing built-in behaviors of the shell as primitives which are connected via functions, reducing those primitives to do the minimal work possible, or even replacing them entirely with pure-<i>es</i> functions.

<p>
An example of this process is <a href=/es/input.html>the set of changes I have been pursuing for shell input</a>.
Historically, the entire process of reading input into <i>es</i> has happened internally as part of the <code>$&amp;parse</code> primitive.
This primitive performs parsing, but it also does everything else that happens during parsing: reading shell input, invoking <code>readline</code> if called for, writing to history, and so on.
Making input more flexible has involved shrinking <code>$&amp;parse</code> so that it only performs lexical analysis and parsing, exposing behaviors like <code>$&amp;readline</code> in new primitives, and connecting these primitives using <i>es</i> script in the <code>%parse</code> function.

<p>


<hr>

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

<h2>Motivation</h2>

<p>
My imagined use cases for pluggable primitives fall into one of the three following categories.

<h3>Extended behaviors</h3>

<p>
There are a number of behaviors which <i>es</i> could have and doesn't, out of a desire to keep <i>es</i> minimal.
I am amenable to that.
However, different people have different behaviors they consider useful to have in a shell, and <i>es</i> currently aims for what is essentially a lowest-common-denominator set of features.

<p>
I think pluggable primitives could be the right way to bridge that divide.
Some functions and behaviors that could be added as extensions to <i>es</i>:

<ul>
<li>Small behaviors, like miscellaneous calls like <code>getcwd(3)</code> or <code>getpid(3)</code>, regexes, or arithmetic (though, in my opinion, arithmetic works best as a glomming-time construct, not a primitive)
<li>Larger additions, like job control or alternative input libraries
<li>Abilities outside what a shell can typically do, such as networking facilities
</ul>

<p>
This is, generally, the category that zsh (see <code>zshmodules(1)</code>) has fairly well covered.

<p>
Some of these items, especially the larger ones, require changes in the core shell runtime to be possible or useful.
Changes to the core shell will be discussed later.

<h3>Build-time functionality</h3>

<p>
prim-dump.c!

<h3>OS specialization</h3>

<p>
<i>Es</i> is highly portable, and that's a very good thing.

<p>
That said, like the previous bullet point, erring towards portability in all things is often functionally equivalent to erring towards the lowest common denominator, as the shell is bound to use the feature set of the POSIX.1-2001 specification.

<p>
With pluggable primitives, <i>es</i> could be kept portable in its core, while in plugged-in primitives make use of non-standard and OS-specific APIs.

<p>
For example: With the right OS support, such as <a href="https://docs.freebsd.org/en/books/handbook/jails/">jails</a> or <a href="https://wiki.freebsd.org/Capsicum">capsicum</a> or <a href="https://man7.org/linux/man-pages/man2/seccomp.2.html">seccomp</a>, could the idea of a restricted shell be made actually meaningful?

<p>
What kind of <a href="https://www.haiku-os.org/blog/humdinger/2017-11-05_scripting_the_gui_with_hey/">Haiku GUI scripting</a> could be made possible, or at least more ergonomic, with built-in shell support?

<p>
These cases overlap with the previous point, but it bears emphasizing that pluggable primitives in <i>es</i> could support specialization to these kinds of per-OS behaviors, without making the core shell a rat's nest of <code>#ifdef</code>s.

<h3>Versioned primitives</h3>

<p>
This is the most radical use case, but in addition to the above, I also believe that a well-designed system for pluggable primitives could be used to support active and backwards-incompatible updates to the shell without actually breaking backwards compatibility.

<p>
This would require, as its major step, migrating existing shell primitives and related functionality out of the &ldquo;core&rdquo; shell and into a set of pluggable primitives.

<p>
It would also require some form of primitive versioning and namespacing, and some way to say &ldquo;when I specify <code>$&amp;time</code> I mean precisely <em>this</em> <code>$&amp;time</code>&rdquo;.

<p>
I am picturing this would enable a way to, essentially, opt-in to &ldquo;the future&rdquo;, with the potential breakage that might entail.
Scripts (and users) which have no need of &ldquo;the future&rdquo; can continue to use older designs for primitives without trouble.

<p>
A specific case would be the recent rewrite of <code>$&amp;time</code> that was recently done.

<h2>Namespacing and versioning</h2>

<h2>Changes to core <i>es</i></h2>

<h2>Prior art</h2>

<h3>zsh</h3>

<h3>Inferno sh</h3>

<h3>mveety&rsquo;s <i>es</i></h3>

<h3>Scheme</h3>
