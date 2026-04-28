<; cat tmpl/header.html >

<title>jpco.io | Thoughts for extensible es primitives</title>
<meta name=description content="Considerations for dynamically loadable primitives in the extensible shell and how they might be used" />

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
As a broad rule, improving the extensibility of <i>es</i> is a process of &ldquo;<em>raising</em>&rdquo; pieces of the shell from lower layers to higher ones: exposing built-in behaviors of the shell as primitives which are connected via functions, reducing those primitives to do the minimal work possible, or even replacing them entirely with pure-<i>es</i> functions.

<p>
An example of this process is <a href=/es/input.html>the set of changes I have been pursuing for shell input</a>.
Historically, the entire process of reading input into <i>es</i> has happened internally as part of the <code>$&amp;parse</code> primitive.
This primitive performs parsing, but it also does everything else that happens during parsing: reading shell input, invoking <code>readline</code> if called for, writing to history, and so on.
Making input more flexible has involved shrinking <code>$&amp;parse</code> so that it only performs lexical analysis and parsing, exposing behaviors like <code>$&amp;readline</code> in new primitives, and connecting these primitives using <i>es</i> script in the <code>%parse</code> function.

<h2>Motivation</h2>

<p>
What follows are a few general categories of potential use cases for extensible primitives.
These might inform an eventual extensible-primitive design.

<h3>Extended behaviors</h3>

<p>
There are a number of behaviors which <i>es</i> could have and doesn&rsquo;t, out of a desire to keep <i>es</i> minimal.
I am amenable to that.
However, different people have different behaviors they consider useful to have in a shell, and <i>es</i> currently aims for what is essentially a lowest-common-denominator set of features.

<p>
I think pluggable primitives could be the right way to bridge that divide.
Some functions and behaviors that could be added as extensions to <i>es</i>:

<ul>
<li>Small features, such as <code>getcwd(3)</code> or <code>getpid(3)</code>, regexes, or arithmetic (though, in my opinion, arithmetic works best in the parser and during glomming, not as a primitive)
<li>Larger additions, like job control or alternative input libraries
<li>Abilities outside what a shell can typically do, such as networking facilities
</ul>

<p>
This is generally the category well-supported by zsh (see <code>zshmodules(1)</code>).
Even though this is the least ambitious category, certain use cases would still require changes to the core runtime to support them.


<h3>OS specialization</h3>

<p>
<i>Es</i> is highly portable, and that&rsquo;s a very good thing.
However, erring towards portability in all things is often functionally equivalent to implementing the lowest common denominator, as the shell is bound to use the feature set of the <span class=uppernum>POSIX.1-2001</span> specification.

<p>
With pluggable primitives, <i>es</i> could be kept portable in its core, while in plugged-in primitives make use of non-standard and OS-specific APIs.

<p>
For example: With the right OS support, such as <a href="https://docs.freebsd.org/en/books/handbook/jails/">jails</a> or <a href="https://wiki.freebsd.org/Capsicum">capsicum</a> or <a href="https://man7.org/linux/man-pages/man2/seccomp.2.html">seccomp</a>, could a new sort of restricted shell be implemented that provides actual meaningful security?

<p>
What kind of <a href="https://www.haiku-os.org/blog/humdinger/2017-11-05_scripting_the_gui_with_hey/">Haiku GUI scripting</a> could be made possible, or at least more ergonomic, with built-in shell support?

<p>
Could one of Linux&rsquo;s many fancy process-handling mechanisms (<code>clone()</code> with all its many flags, pidfds, etc.) be exploited to good advantage?

<p>
These cases overlap with the previous point, but it bears emphasizing that pluggable primitives in <i>es</i> could support specialization to these kinds of per-OS behaviors, without making the core shell a rat&rsquo;s nest of <code>#ifdef</code>s.


<h3>Versioned primitives</h3>

<p>
In addition to the above, I also believe that a well-designed system for pluggable primitives could be used to support active and backwards-incompatible updates to the shell without actually breaking backwards compatibility.

<p>
This would require, as its major step, migrating existing shell primitives and related functionality out of the &ldquo;core&rdquo; shell and into a set of pluggable primitives.

<p>
It would also require some form of primitive versioning/namespacing, and some way to say &ldquo;when I call <code>$&amp;time</code> I mean <em>this version of</em> <code>$&amp;time</code>&rdquo;.

<p>
I am picturing this would enable a way to, essentially, opt-in to &ldquo;the future&rdquo;, with the potential breakage that might entail.
Scripts (and users) which have no need of &ldquo;the future&rdquo; can continue to use older designs for primitives without trouble.

<p>
A specific case would be the recent rewrite of <code>$&amp;time</code> that was recently done.
While the new version seems like a strict improvement on the previous one (being capable of everything the old primitive could do and more), it is a backwards-incompatible change, because it changes how the <code>$&amp;time</code> primitive is called.
This could be side-stepped with a mechanism that lets users select the newer time specifically.


<h3>Build-time functionality and alternative shell binaries</h3>

<p>
More flexibility in primitives could also be used to generalize <i>es</i>&rsquo; current build process into an <i>es</i>-binary-generating mechanism.

<p>
The current build process of <i>es</i> involves:

<ol>
<li>building the <code>esdump</code> binary with <code>dump.c</code>
<li>running it so that it reads <code>initial.es</code> from stdin and then dumps the shell&rsquo;s memory state to <code>initial.c</code> in its stdout
<li>building the real <code>es</code> binary with <code>initial.c</code>
</ol>

<p>
This is all specialized, hard-coded behavior, and still requires <code>esdump</code> to have access to the same set of primitives as the built <code>es</code>.
As a first step, build-time primitives could be loaded only during <code>initial.es</code> evaluation for bootstrapping purposes: for example, a built-in <code>$&amp;batchloop</code> currently needs to exist to evaluate <code>initial.es</code>, but <code>initial.es</code> can define an <i>es</i>-written <code>%batch-loop</code> function at which point <code>$&amp;batchloop</code> can be excised.

<p>
However, it could be possible to go even further and build <code>esdump</code> as an <i>es</i> binary which loads a particular set of bootstrapping-oriented primitives, such that it calls <code>$&amp;dumpinitial</code> to generate an <code>initial.c</code>, and then have the final <code>es</code> binary load that state using a <code>$&amp;loadinitial</code> primitive defined in <code>initial.c</code>.

<p>
This would be most useful combined with a set of changes like what I propose in <a href="https://github.com/wryun/es-shell/pull/79">my <code>es-main</code> branch</a>, so that the only thing the core runtime does at startup is call the <code>%main</code> hook function with its argument list, leaving everything else up to the es-dumping script and primitives or the &ldquo;real&rdquo; shell setup defined in <code>initial.es</code> and the shell-related primitives.

<p>
Hypothetically, this would actually be a general mechanism which could build a specialized <i>es</i> binary, potentially <em>without</em> a REPL, parser, or other general shell-like mechanisms, with its starting point at the <code>%main</code> function.
This points toward the long-standing goal of a Tcl-like &ldquo;librarified <i>es</i>&rdquo;.

<p>
A consideration that this use case raises is the problem of what would be done with the <code>$&amp;loadinitial</code> primitive after shell startup.
The primitive only really makes sense to call at shell startup, but after a certain point it becomes nothing but a problem.
A similar problem is present in the <code>es-main</code> branch with the <code>$&amp;importenvfuncs</code> primitive.
The ability to remove a primitive from the primitive table could be practically useful.
This overlaps with possible ideas around restricted shells, secure shells, or otherwise controlling the extensibility of the shell.

<h2>Prior art</h2>

<h3>zsh</h3>

<p>
Zsh is probably the shell most famous for its linkable modules, which give it even more features on top of its already prodigious feature set.
These, of course, fall into the &ldquo;extended behaviors&rdquo; bucket.

<p>
<i>Es</i> and zsh are not very similar in their design goals, but zsh&rsquo;s success means that it is worth looking at what extended behavior might be useful to have, if not exactly how to get there.

<p>
Modules documented in <code>zshmodules(1)</code> include:

<ul>
<li><code>zsh/attr</code>
<li><code>zsh/cap</code>
<li><code>zsh/compctl</code>, <code>zsh/complete</code>, <code>zsh/complist</code>, <code>zsh/computil</code>
<li><code>zsh/curses</code>
<li><code>zsh/datetime</code>
<li><code>zsh/pcre</code>, <code>zsh/regex</code>
<li><code>zsh/net/socket</code>, <code>zsh/net/tcp</code>
<li><code>zsh/zle</code>
<li><code>zsh/zpty</code>
</ul>

<p>
It also looks like zsh also has a setup for namespacing modules, at which we might take a gander.
It seems quite sensible to model module namespacing after path names; perhaps primitives could look like <code>$&amp;es/parse</code>.


<h3>Inferno <i>sh</i></h3>

<p>
The shell from <a href="http://inferno-os.org/">the Inferno OS</a>, simply <a href="https://inferno-os.org/inferno/papers/sh.pdf">called <i>sh</i></a>, has a concept of modules much more deeply integrated than zsh&rsquo;s.
This shell, which incidentally is directly inspired by <i>es</i>, moves most of the typical behaviors of a shell out of its core runtime, leaving (as documented in its paper) only <code>builtin</code>, <code>exit</code>, <code>load</code>, <code>loaded</code>, <code>run</code>, <code>unload</code>, <code>whatis</code>, and a couple quoting utilities.

<p>
This is just enough capability to manage to load other modules, particularly the <code>std</code> module which contains most of the functionality that people expect in a shell, like <code>fn</code>, <code>!</code>, <code>and</code>, <code>or</code>, <code>if</code>, and <code>whatis</code>.
Where the zsh module system seems to be designed around adding extra behaviors to a shell, this design corresponds with the other use-cases.

<p>
Unfortunately, this <i>sh</i> and the OS on which it is built has become museum-piece software over the years, so the design hasn&rsquo;t been exercised especially intensely.
However, it might be a productive exercise to try to pull out as many of <i>es</i>&rsquo; primitives into some kind of <code>es</code> module and see what the minimal set of bootstrapping behaviors actually are.


<h3>Scheme</h3>

<p>
Scheme is a major influence on <i>es</i>, and R<sup>6</sup>RS developed a 


<h3>Python</h3>

<p>
You know Python.
People have the ability to extend the Python interpreter with modules, so <a href="https://docs.python.org/3/extending/">let&rsquo;s look at that</a>.

<h2>Limitations</h2>

<p>
For this kind of primitive extensibility to be as effective as possible&mdash;particularly with longer-term goals such as alternative (non-shell) <i>es</i> binaries, a number of behaviors would need to be &ldquo;lifted&rdquo; out of the core shell runtime and into primitives and scripted functions.

<p>
Running external binaries, and how that would be done, is one such case.
See <a href="https://github.com/wryun/es-shell/pull/241">my <code>%whatis</code>- and <code>%run</code>-changing PR</a>, also useful for my job control design.
This change is sufficient to remove the special ability to run external binaries from the core shell runtime, instead making it a possible shell-related extension.

<p>
Interaction with the environment is a big one.
This would look like some way to explicitly go about importing variables from the environment on the one hand (with some degree of control over <em>which</em> things are imported, for the sake of the <code>-p</code> flag), and a way to explicitly manage the exporting of variables to the environment.
The <code>noexport</code> variable already exists, but is almost certainly insufficient for the job; as a starting point for this extensibility, it should be possible for people to forsake the <i>rc</i>-inspired method of interacting with the environment in favor of a more bash- and other POSIX-shell-based method.
I could see this being covered by:

<ul>
<li>An <code>$&amp;environment</code> primitive containing a list of names of variables present in the environment (this could also be a variable <code>$environment</code>, though the semantics around what should happen to <code>$environment</code> when <code>$&amp;setenv</code> adds or removes a variable in the environment).

<li>A <code>$&amp;getenv</code> primitive which takes an environment variable name and returns its value.

<li>A <code>$&amp;setenv</code> primitive which takes a variable name and value and sets the name to the value in the environment (or at least pretends to do so in such a way that a user can&rsquo;t reasonably tell the difference&mdash;shells often like to play these games around the environment).

<li>A single, general <code>%set</code> hook which would call settor functions as well as export values subject to <code>$noexport</code>.
<code>%set</code> would potentially be useful for other purposes as well, such as making certain variables read-only for a sort of restricted shell environment.
</ul>

<p>
Parsing is another big one&mdash;plenty of people might not want a non-shell command language with redirection or pipes or I/O substitution.
Extensibility in the parser was a goal of the original authors, but didn&rsquo;t go anywhere.
This could still potentially be done, but a simpler story would be to use extensible primitives to &ldquo;swap out&rdquo; which parser is used in different settings.
It is already the case that environment-parsing is almost entirely performed on desugared <i>es</i> commands, so a parser that only understands the desugared language should be highly effective in that case.
Automatic conversion from strings more frequently needs to parse &ldquo;sugary&rdquo; syntax, but a hook could be exposed to allow the right parser to be selected.
All of this would be improved by a more-orthogonal parser which does not perform any implicit redirection (see <a href=/es/input.html>my discussion of recent input changes</a> for details).

<p>
Globbing is yet another case: outside of a shell, a command like <code>echo *</code> may not be most useful as a way to list files in the current working directory, but instead any other set of currently-relevant objects (an example given long ago was program symbols in an <i>es</i>-powered debugger.)
Unfortunately, despite the fact that exposing the shell in a meaningful way has been a desire for almost as long as the shell has existed, there has hardly even been a design proposed to actually do so.
In large part, this is because it&rsquo;s difficult to expose to users the difference between <code>*</code> and <code>'*'</code>: glomming, and the subset that is globbing, directly works with data structures that are hard to work with in <i>es</i> script.
