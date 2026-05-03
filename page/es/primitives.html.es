<; cat tmpl/header.html >

<title>jpco.io | Thoughts for extensible es primitives</title>
<meta name=description content="Considerations for dynamically loadable primitives in the extensible shell and how they might be used" />

<; build-nav >

<main>
<h1>Thoughts for extensible <i>es</i> primitives</h1>
<div class=time><time datetime="2026-05-03">2026-05-03</time></div>

<p>
The extensible shell <i>es</i> can be thought of has having three layers, each with different degrees of malleability.

<p>
The <em>top</em> layer contains everything defined in the shell: variables and functions.
Due to the nice qualities of <i>es</i>, this layer includes things like the definition of the interactive and non-interactive REPLs, control flow constructs like <code>while</code>, path-searching behavior, the <code>cd</code> builtin, and so on.
This is the &ldquo;extensible&rdquo; part of the extensible shell.

<p>
The <em>bottom</em> layer is the core shell runtime implementing the GC, data structures, variables, closures, glomming, and so on.
In general, nothing in this layer is modifiable without hacking on the runtime, since this is the foundation of the shell and needs to be kept coherent to support everything else.
This layer also tends to work with data outside of the abstractions available to <i>es</i> data structures, making it difficult to express the desired behavior of these mechanisms using the shell language at all.
There are a few hooks into specific behaviors at this layer, such as the <code>%home</code> hook function, but for the most part this layer is implicit or even invisible.

<p>
Betwee the core shell runtime and the user-definable functions and variables sits the <em>middle</em> layer, which is the topic of this page: it is the <em>primitives</em> layer.
Primitives are the callable objects in <i>es</i> script which are implemented using C, and which, in some sense, make up the &ldquo;standard library&rdquo; of the shell.
A large proportion of the shell&rsquo;s behaviors, especially those that are relevant to its nature as a <em>shell</em>, are done by primitives such as <code>$&amp;pipe</code>, <code>$&amp;fork</code>, <code>$&amp;read</code>, and <code>$&amp;echo</code>.
While the internals of a primitive are opaque, a well-designed and well-documented primitive has behavior that is understandable, predictable, and orthogonal to other primitives.

<p>
As a broad pattern, improving the extensibility of <i>es</i> is a process of &ldquo;<em>raising</em>&rdquo; pieces of the shell from lower layers to higher ones: exposing built-in behaviors of the shell as primitives which are connected via functions, reducing the scope of those primitives, or even replacing them entirely with pure-<i>es</i> functions.

<p>
However, there is an entire angle of extensibility which could also be in <i>es</i> but isn&rsquo;t, and that is in extending the set of primitives present in the shell.
Today, <i>es</i> has a fairly fixed, rigid set of primitives; for a few primitives, it is possible to tweak whether they are included in the shell using build flags, but that control is limited to just those special primitives, and its implementation is messy and ad-hoc in the same way that any other preprocessor-based code inclusion based on <code>#ifdef</code> is.

<p>
This page is an exploration of what it might look like to make <i>es</i> primitives more properly extensible, and how far that idea could be taken.
As it turns out, there seems to be a path forward all the way to a Tcl-style &ldquo;librarified&rdquo; <i>es</i>, which can be used as a command language in ways unrelated to its current role as a Unix shell, which <a href=/es/paper.html#future-work>has long been a goal of the original authors</a>.
And, while this distant goal is enticing, there is also utility in more modest changes required to get there.


<h2>Motivation</h2>

<p>
What follows are a few general categories of potential use cases for extensible primitives.
These are in order roughly from the least ambitious to most ambitious.


<h3>Extended behaviors</h3>

<p>
There are a number of behaviors which <i>es</i> could have and doesn&rsquo;t, out of a desire to keep the shell small.
As a design target, <i>es</i> by default only exposes a set of features comparable to that of <i>rc</i>, which could be considered the optimal minimal set.
However, many people expect more features, and, excitingly, different people expect different combinations of features.
While the extensibility of <i>es</i>&rsquo; scripting layer can cover much of this diversity, some of it can only be implemented with support from the C runtime.
This is where extensible primitives can come in.

<p>
Some particular ideas for this include small additions such as <code>$&amp;getpid</code> or <code>$&amp;getcwd</code> (the absence of the latter in <i>es</i> today seems to be a direct cause of an additional 20-50 lines of every single <i>es</i> user&rsquo;s <code>.esrc</code>).
Similarly, marginal features such as arithmetic or regular expressions could be added to the shell relatively cheaply as primitives (although, in my opinion, arithmetic would ideally be performed as part of glomming, rather than as a set of commands).
Shell input libraries are another likely candidate&mdash;<i>es</i>&rsquo; input logic has recently been refactored so that readline is exposed entirely as a set of primitives, and other input libraries could be added to the shell in a similar way.

<p>
Extensible primitives could also be used to do things not traditionally performed by shells.
Both bash and zsh have some facilities for networking, for example.
Designs for coprocesses, too, could be developed.
More radically, many recent shells have focused on working with structured data in certain constructs where traditional shells would work on simple strings, and <i>es</i> could do the same, with the right primitive support.


<h3>Experimental contributions</h3>

<p>
As I see it, <i>es</i> developers today face a dilemma.
Either they keep their contributions in a personal fork, limiting its reach and making it harder for good ideas to compound, or they attempt to upstream their changes into a very conservative codebase, probably resulting in a response of &ldquo;thanks for the attempt, but no thanks.&rdquo;

<p>
I believe this has a chilling effect on contribution, and, given <i>es</i> doesn&rsquo;t exactly suffer from an overabundance of contributors, I believe this has a chilling effect on the shell as a whole.

<p>
A mechanism for extensible primitives, by providing <i>es</i> a way to more flexibly include code, could offer a way to resolve this dilemma.
Experimental changes could be added to the upstream <i>es</i> repository as a set of extensible primitives, and only be included in the shell on an opt-in basis.  This would improve the visibility of these changes compared to stuffing them in a personal repo, without immediately needing to be fully, backwards-compatibly &ldquo;production grade&rdquo;.

<p>
This is, of course, closely related to the extended-behaviors use case, as many extended behaviors would likely be (or at least start as) experimental changes.
However, it is also likely that people may want to create alternate implementations of existing primitives.
This suggests that <i>es</i>&rsquo; extensible-primitives mechanism should provide a facility for this, and potentially a facility to express that a primitive expression like <code>$&amp;parse</code> should refer to a particular <em>version</em> of a parse primitive.


<h3>OS specialization</h3>

<p>
<i>Es</i> is highly portable, and that&rsquo;s a very good thing.
However, erring towards portability is often in practice merely implementing the lowest common denominator of behavior, as the shell is limited to the feature set of the <span class=uppernum>POSIX.1-2001</span> specification.

<p>
Extensible primitives could provide a structured way to keep <i>es</i> portable in its core, but still make use of non-standard and OS-specific APIs as desired.

<p>
For example: With the right OS support, such as <a href="https://docs.freebsd.org/en/books/handbook/jails/">jails</a> or <a href="https://wiki.freebsd.org/Capsicum">capsicum</a> or <a href="https://man7.org/linux/man-pages/man2/seccomp.2.html">seccomp</a>, could a new sort of restricted shell be implemented that isn&rsquo;t compromised in the same ways as traditional restricted shells?
What kind of <a href="https://www.haiku-os.org/blog/humdinger/2017-11-05_scripting_the_gui_with_hey/">Haiku GUI scripting</a> could be made possible, or at least more ergonomic, with built-in shell support?
Could one of Linux&rsquo;s many fancy process-handling mechanisms (<code>clone()</code> with all its many flags, pidfds, etc.) be exploited to good advantage?

<p>
This could take the form of additional primitives for additional behavior, or alternatives to existing primitives for specialization.
A related point here is that this may involve primitives implemented across languages.
Fortunately, C is already the <i>lingua franca</i> of FFI, but attempting to work in other languages has implications for some of the more pathological aspects of <i>es</i>&rsquo; runtime, like its exception mechanism.


<h3>Versioned primitives</h3>

<p>
If designed properly, a system for extensible primitives could be used to support a better, more flexible backwards compatibility story, by allowing newer versions of primitives to be made available without (immediately) removing the older behavior on which users depend.

<p>
The descriptions of other use-cases have already mentioned supporting multiple versions of a given primitive, and this case would follow through on that idea.
It would require most of the shell&rsquo;s built-in primitives to be moved into an extensible-primitive library, but assuming that is done, then already-mentioned methods to specify &ldquo;<code>$&amp;parse</code> refers to <em>this</em> person&rsquo;s implementation of <code>$&amp;parse</code>&rdquo; would work just as well to specify, say, &ldquo;the <code>es-0.10.0</code> version, rather than the <code>es-0.9.3</code> version&rdquo;.

<p>
This could allow the future to become just another opt-in feature.
Scripts (and users) which have no need of the future can continue to use older designs for primitives without trouble.

<p>
A specific example here would be the rewrite of <code>$&amp;time</code> that was recently done.
While the new version is a strict improvement on the previous one (being capable of everything the old primitive could do and more), it is a backwards-incompatible update, because it changes the parameters of the <code>$&amp;time</code> primitive.
This could be side-stepped with a mechanism that lets users select the newer or older <code>$&amp;time</code> specifically.


<h3>Build-time functionality and alternative shell binaries</h3>

<p>
Extensible primitives could become part of the <i>es</i> build process, and even be used to build alternate <i>es</i>-based binaries.

<p>
The way <i>es</i> is currently built involves:

<ol>
<li>building the <code>esdump</code> binary, containing the core <i>es</i> runtime as well as <code>dump.c</code>
<li>running <code>esdump</code> so that it runs <code>initial.es</code> and then dumps the shell&rsquo;s memory state to <code>initial.c</code>
<li>building the real <code>es</code> binary with the generated <code>initial.c</code>, which starts the real shell
</ol>

<p>
This is all specialized, hard-coded behavior, which could be generalized by refactoring the build (and startup) process to make use of extensible primitives.
Instead of a distinct <code>esdump</code> binary, dumping behavior could be performed by an <i>es</i> binary/script which loads dumping-specific primitives, reads <code>initial.es</code>, and then calls <code>$&amp;dump</code>.
The <code>$&amp;dump</code> primitive could produce a C file which itself defines a <code>$&amp;loadinitial</code> primitive, and then the final <i>es</i> binary could run that <code>$&amp;loadinitial</code> on startup.

<p>
If properly designed, this process can be generalized to produce alternative <i>es</i>-based programs, which don&rsquo;t necessarily even act as shells.
This could even be a method to produce something like a librarified <i>es</i>, though the binary&rsquo;s <code>main()</code> would be in the <i>es</i> code.
This would, I think, represent the full development of the concept of extensible primitives.


<h2>Prior art</h2>

<h3>zsh</h3>

<p>
Zsh is probably the shell most famous for its linkable modules, which give it even more features on top of its already prodigious feature set.
These largely fall into the &ldquo;extended behaviors&rdquo; case.
<i>Es</i> and zsh are not very similar in their design goals, but the amount of time and attention paid to zsh means that it is worth looking at for inspiration as far as uses of extensible primitives, if not their design or implementation.

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
Zsh also seems to have namespacing that it uses for its module system.


<h3>Inferno <i>sh</i></h3>

<p>
The shell from <a href="http://inferno-os.org/">the Inferno OS</a>, simply <a href="https://inferno-os.org/inferno/papers/sh.pdf">called <i>sh</i></a>, has a concept of modules deeply integrated into its functionality.
This shell, which incidentally directly names <i>es</i> as an inspiration, moves most of the typical behaviors of a shell out of its core runtime, leaving (as documented in its paper) only <code>builtin</code>, <code>exit</code>, <code>load</code>, <code>loaded</code>, <code>run</code>, <code>unload</code>, <code>whatis</code>, and a couple quoting utilities.

<p>
This is just enough capability to load other modules.  The behaviors to actually implement a shell are then placed in the <code>std</code> module, which defines functions like <code>fn</code>; <code>!</code>, <code>and</code>, and <code>or</code>; <code>if</code>, <code>for</code>, and <code>while</code>; <code>whatis</code>; and <code>raise</code> and <code>rescue</code>, its versions of <code>throw</code> and <code>catch</code>.
Whereas zsh modules are oriented toward adding features on top of an already capable shell, <i>sh</i>&rsquo;s modules are used to build a shell from a minimal language runtime.
(Some behaviors which are functions in <i>sh</i>, like <code>fn</code> and <code>for</code>, cannot be functions in <i>es</i> due to their interaction with lexical scope; if they were not in the core <i>es</i>, these would need to be implemented using an alternative parser or some kind of extensible syntax instead.)

<p>
Unfortunately, <i>sh</i> and the inferno OS on which it depends have become museum-piece software over the years, so the design hasn&rsquo;t been exercised especially intensely.
However, it serves as probably the most relevant prior art for a potential concept of <i>es</i> which is built on top of extensible primitives.


<h3>&ldquo;Real&rdquo; programming languages</h3>

<p>
It is possible to extend the Python interpreter with modules, so <a href="https://docs.python.org/3/extending/">let&rsquo;s look at how that works</a>, and, potentially, how it is used.
This includes the ability to create opaque, module-specific objects in Python; <i>es</i> has no facility for this at the moment, but it is worth considering a mechanism for opaque handles, as some built-in behavior (file handling) would benefit from the behaior, and it is likely to be useful in <i>es</i> &ldquo;modules&rdquo; as well.

<p>
Python also explicitly enables the ability to import the <code>__future__</code> using <a href="https://peps.python.org/pep-0236/">future statements</a>.
Lessons from future statements and how they help with backwards compatibility, as well as the general difficulties of Python 2-to-3, should be informative for the design of extensible primitives as a change-management feature.


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
