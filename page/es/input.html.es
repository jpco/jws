<; cat tmpl/header.html >

<title>jpco.io | Giving the extensible shell extensible input</title>
<meta name=description content="This page discusses how input works in the extensible shell es, and how it is being improved.">

<; build-nav >

<main>
<h1>Giving the extensible shell extensible input</h1>
<div class=time><time datetime=2026-04-08>2026-04-08</time></div>

<p>
Compared with other shells, the way that <a href=/es><i>es</i></a> reads input from scripts or from an interactive terminal session has historically been badly lacking.
Whereas interactive features tend to be a major, or the <em>only</em>, attractive feature of many shells, in <i>es</i> the support for interactivity is meager&mdash;and support for customizing that behavior is almost nonexistent.

<p>
To some degree this is intentional: <i>es</i>, coming from <i>rc</i>, tries to be relatively minimalist by default.
Unlike, for example, <a href="https://fishshell.com">fish</a>, the default behavior when dropping into <i>es</i> for the first time will probably always be a simple prompt:

<figure>
<pre>
<samp>; </samp>
</pre>
</figure>

<p>
But whatever the defaults are, <i>es</i> is intended to be <em>extensible</em>.
It should be perfectly possible to get a more advanced interactive setup akin to fish&mdash;and, in fact, being able to do more with input has been a long-term desire for both users and authors of the shell.
The fact that this has been impossible thus far has all come down to problems in implementation.

<h2>How input works</h2>

<p>
Like other shells, <i>es</i> can be given shell input in a few forms: an argument (when invoked with <code>es -c</code>); a named file which is opened and read (<code>es script.es</code>); or via standard input (<code>es</code> with no arguments).

<p>
When first given an input, depending on which type of input it is, the shell decides whether it should be treated as &ldquo;interactive&rdquo;.
Interactivity can be forced by the user with the <code>-i</code> flag, but typically the decision is made automatically based on whether the input is both stdin (fd 0) and a TTY (based on the <code>isatty(3)</code> library call).
Based on this, one of the two <em>loop</em> functions is called in order to read and execute the input: <code>%interactive-loop</code> if interactive, or <code>%batch-loop</code> otherwise.

<p>
These two loop functions are the central part of the <i>es</i> runtime.
At their core, they contain a call to <code>%parse</code>, which reads and parses the input and produces a command, and then an invocation of that command.

<p>
This looks something like the following.
Note that <code>%parse</code> also takes the prompt as its argument list, making something like:

<figure>
<pre>
<code>forever {
	let (cmd = &lt;={%parse $prompt}) {
		$cmd
	}
}</code>
</pre>
</figure>

<p>
There is more to the real loop functions than this, and they are complex and important enough to deserve their own entire page of documentation, but this is accurate as far as the call to <code>%parse</code> goes.

<p>
But consider that <code>%parse</code> call.
It makes plenty of sense that a function called <code>%parse</code> would perform parsing, of course.
But why is <code>%parse</code> also responsible for <em>reading</em> shell input?
After all, the shell has other mechanisms to read files.
And why does <code>%parse</code> take <code>$prompt</code> as arguments?
Can the reading behavior in <code>%parse</code> be changed at all?
It&rsquo;s that exact behavior that we would want to get at, if we want to make <i>es</i> capable of fancy interactivity à la fish or zsh.

<p>
Unfortunately, if we try to look at the definition of <code>%parse</code> to get more answers, we get:

<figure>
<pre>
<code>; whatis %parse
$&amp;parse</code>
</pre>
</figure>

<p>
Everything that <code>%parse</code> does is locked away within the <code>$&amp;parse</code> primitive.


<h2><code>$&amp;parse</code> does too much</h2>

<p>
Given what the <code>$&amp;parse</code> primitive actually does, it would more accurately be called <code>$&amp;readfromshellinputandparse</code>.
<code>$&amp;parse</code> does do what it claims to, <em>parse</em> unstructured input to produce a code fragment, but to actually get at that input, it reads from the shell&rsquo;s input using either special buffered read logic (which can&rsquo;t be used anywhere else) or <code>readline(3)</code> (which also can&rsquo;t be called any other way in <i>es</i>).

<p>
As it turns out, all this hard-coding is determined by internal details of how the parser interacts with the shell&rsquo;s memory management.
<i>Es</i>&rsquo; garbage collector needs to track every bit of shell state to know what can be safely corrected.
The parser, which is yacc-generated code unaware of the conventions of the rest of the codebase, holds references to garbage-collected data while it is running, and doesn&rsquo;t maintain the garbage collector&rsquo;s reference list, because it has no idea there is such a thing.
This means that while the parser is active, the garbage collector may have an invalid list of live references, so it can&rsquo;t correctly run.
Since <i>es</i> code requires garbage collection, it can&rsquo;t run while the parser is active.

<p>
This stinks!
A quirk of memory management forces so much to be hard-coded inside of <code>$&amp;parse</code>, where it&rsquo;s all completely inflexible and invisible to the user.
And, because it has the shell&rsquo;s readline call buried inside of it, there&rsquo;s nothing like a <code>$&amp;readline</code> primitive that users can call, either&mdash;and no way at all to use readline to get any input that won&rsquo;t then be processed by the parser.
In a shell which has been praised for its <a href="http://www.catb.org/~esr/writings/taoup/html/ch04s02.html#orthogonality">orthogonality</a>, this is a glaring deficiency.

<p>
So, how should we fix this?

<p>
As an exercise, let&rsquo;s forget the implementation and imagine how a hypothetical <code>$&amp;parse</code> <em>should</em> behave from a user&rsquo;s point of view.
At first blush, we want a <code>$&amp;parse</code> which

<ol>
<li>takes a string argument containing unstructured <i>es</i> code, and
<li>returns code fragment corresponding with that string.
</ol>

<p>
However, this runs into a problem: for most languages, including <i>es</i>, it&rsquo;s actually impossible to know how much input the parser will need before doing the parsing.
Consider the following contrived <i>es</i> snippet as an example:

<figure>
<pre>
<code>{
	echo &lt;=%read
	echo &lt;=%read
} &lt;&lt; EOF
hello world
goodbye world
EOF

echo hello world
echo goodbye world</code>
</pre>
</figure>

<p>
The first seven lines must be parsed together to produce a single code fragment, but the remaining three must be parsed separately.
But other than by actually parsing, it&rsquo;s hard to know this; you have to track the <code>{</code>s and <code>}</code>s, and, worse, you have to know when the heredoc starts and ends.
You could, potentially, do a sort of pre-parsing pass to figure out how to delimit commands, but it simply isn&rsquo;t worth it.

<p>
Instead, the parser is given a mechanism to request input as it needs it.
This is how the internal yacc-generated parser in <i>es</i> works.
In the yacc world, the mechanism is a function named <code>yylex()</code>.
In <i>es</i>, since we have fancy things like higher-order functions, we can give <code>%parse</code> a <em>reader command</em> as an argument.
This might look like, to adapt the previous loop function snippet,

<figure>
<pre>
<code>forever {
	let (cmd = &lt;={%parse %read}) {
		$cmd
	}
}</code>
</pre>
</figure>

<p>
The change between the original loop and what we have here is very small&mdash;we&rsquo;ve just gone from the original <code>{%parse $prompt}</code> to <code>{%parse %read}</code>.
(We&rsquo;ve lost <code>$prompt</code> in this change, but that will be addressed in a second.)

<p>
In this case, <code>%read</code> is that reader command that we give to <code>%parse</code> to call whenever it wants to read more input.
When <code>$&amp;parse</code> runs, it redirects the internally-managed shell input (whether it&rsquo;s a file or a string from the command line) to the standard input of <code>%read</code>.
This reader command will be called at least once, and potentially many more times, until the parser has received enough input to produce a completely-parsed command.

<p>
So, this is our goal design for <code>$&amp;parse</code>.

<p>
How do we get interactive features, like prompting, readline, history, and so on, on top of this?

<p>
Let&rsquo;s reorient the design here so that instead of changing how <code>%parse</code> is called within the loop functions, we&rsquo;re instead producing a <code>%parse</code> function which works the same as before on top of our new <code>$&amp;parse</code> primitive.

<p>
We have no way to call readline, so we will have to add one: call it <code>$&amp;readline</code>.
We&rsquo;ll talk about this new primitive in more detail later, but for now it suffices to say that <code>$&amp;readline</code> should take one optional argument, a prompt, and return either a line of input or the empty list, with the same semantics as <code>$&amp;read</code>.
(Conveniently, these are also essentially the exact calling semantics of the <code>readline(3)</code> function.)
To make things consistent for folks who do and do not include readline in their <i>es</i>, we define a <code>%read-line</code> function which wraps <code>$&amp;readline</code> if present and otherwise is defined as <code>@ prompt {echo -n $prompt; %read}</code>.

<p>
We already have a hook function for writing to history, <code>%write-history</code>, so we also need to add a call to that.
Putting these things together, with the appropriate scaffolding, creates a <code>%parse</code> which looks like:

<figure class="centered bigfig">
<pre>
<code>fn %parse prompt {
	if %is-interactive {
		let (in = (); p = $prompt(1))
		unwind-protect {
			$&amp;parse {
				let (r = &lt;={%read-line $p}) {
					in = $in $r
					p = $prompt(2)
					result $r
				}
			}
		} {
			if {!~ $#fn-%write-history 0 &amp;&amp; !~ $#in 0} {
				%write-history &lt;={%flatten \n $in}
			}
		}
	} {
		$&amp;parse  # fall back to built-in read
	}
}</code>
</pre>
<figcaption>The new definition of <code>%parse</code>.</figcaption>
</figure>

<p>
The interactive logic is wrapped in an <code>%is-interactive</code> check, for obvious reasons.
We also buffer the input that gets read and write it to shell history, and there is also a little logic for picking the right prompt at the right time.
Note that a couple specific behaviors become visible here, now that they&rsquo;re in <i>es</i> script, <em>and</em> they can be changed:

<ul>
<li>we use the first term of <code>$prompt</code> before the first line, and the second term before each subsequent line
<li>we buffer a whole command before writing it to history, rather than writing each line to history individually as it is read
<li>we write inputs to history even when they cause <code>$&amp;parse</code> to throw an exception, such as with syntax errors
</ul>

<p>
So now we have a new <code>$&amp;parse</code> that has less built-in behavior, and a new <code>%parse</code> which wraps it to maintain the same behavior that it had before.


<h2>Reimplementing <code>$&amp;parse</code></h2>

<p>
This is the part of the page where I reveal that this change has already been made to <i>es</i>; as of quite recently, <code>$&amp;parse</code> has been reimplemented to take a reader command, and <code>%parse</code> has been rewritten to wrap this new <code>$&amp;parse</code> and provide the same calling convention as before.

<p>
So, how was the memory management problem resolved in order to make this possible?

<p>
Fixing that took a couple different attempts.
My first angle was to fix the parser so that any live references it was holding would be in the GC&rsquo;s root list.
I tried implementing this with a hand-written parser with <a href=/es/runtime-quirks.html#gc>the appropriate <code>Ref()</code> macro calls</a> scattered throughout the parser code, but I abandoned this when it was turning out to be obnoxiously slow to run.

<p>
My next attempt was to rewrite the parser using <a href="https://sqlite.org/src/doc/trunk/doc/lemon.html">the lemon parser generator</a> from the SQLite project.
Lemon is a pretty great parser generator which has two features in particular that I was interested in: it allows a lot of control over how the parser code is generated, and it generates a &ldquo;push-style&rdquo; parser.
Together, these two things meant that while the shell was reading input, all the state held by the parser could be encapsulated in a single <code>Parser</code> object which could be wired up so the entire parser could be GC&rsquo;d as one big blob.
This ended up running into some of the same problems as the first attempt.

<p>
In general, I was finding that swapping out the entire <i>es</i> parser was too big of a change for what I was going for.
Despite not wanting to change anything about the grammar of the language or the actual behavior of the parser, I was swapping the whole thing out, potentially introducing either any number of bugs or a serious performance regression.
So I shelved the idea for a while to work on other things.

<p>
What brought me back to this goal was the realization that I didn&rsquo;t have to change the parser in order to change how it performs memory management&mdash;I could change the memory management system instead.
So, to keep the parser&rsquo;s untracked memory references safe, I moved them &ldquo;out of the way&rdquo;.

<p>
In addition to the existing memory &ldquo;spaces&rdquo;, for non-garbage-collected and garbage-collected objets, I added a third kind of memory, which I called <em>pspace</em>, for &ldquo;parser space&rdquo;.
Pspace is a variation on GC space, with one critical difference: it is only ever collected once, where exactly one pointer and its referents are copied out to some other space (typically GC space), at which point the pspace is destroyed.
The point of this is that while the shell can&rsquo;t know which references are live <em>during</em> parsing, it certainly knows what&rsquo;s live once parsing has finished&mdash;the parse tree.

<p>
This allowed me to get a proof-of-concept going of this new <code>$&amp;parse</code>, at which point I immediately ran into a new problem.
I had forgotten that, because code coming from places like the environment is stored in an unparsed string form, merely running <i>es</i> script often (and at unpredictable times) requires parsing it.
Being able to run the parser in the middle of another parse run, therefore, is necessary.

<p>
This was yet another hurdle for the shell&rsquo;s yacc-generated parser, and this time, unfortunately, there was no clear workaround: a portable (POSIX) yacc-based compiler simply must rely on static (global) variables, which means that having two running concurrently in a single thread is not going to work.
However, while digging around, I found that yacc parser generators these days seem to be a total duopoly: you can have bison, or you can have byacc.
Unlike with C compilers, I couldn&rsquo;t find any alternatives to try out <em>at all</em>.

<p>
So, I cheesed it&mdash;<i>es</i> can still be built with either bison or byacc, but it requires at least one non-portable extension which both of them support.
To make up for this, I decided to also put the generated parser into the repo, so that anybody just building the shell won&rsquo;t need a yacc at all.

<p>
The extension in question is the line

<figure>
<pre>
<code>%define api.pure full</code>
</pre>
</figure>

<p>
which <a href="https://www.gnu.org/software/bison/manual/html_node/Pure-Decl.html">moves the statically-allocated variables involved in parsing</a>&mdash;particularly <code>yylval</code>&mdash;into the parameter lists of the parser functions.

<p>
After this, the rest of the concurrent parsing work was a matter of moving other static variables into the stack.
I defined a new <code>Parser</code> struct which absorbed all of this state, as well as the members of the <code>Input</code> struct which only live over the course of a single parse.
Finally, at this point, the changes to actually implement the <code>$&amp;parse</code> described above could begin.

<p>
Doing this, after everything else, was actually reasonably simple.
There is a function <code>fill()</code> which is called to, well, <em>fill</em> the input buffer used by the lexical analyzer.
This function would previously call either readline or read (not the primitive; custom, internal logic of the <code>Input</code>).
Changing it to call a command was a matter of saving the command given to <code>$&amp;parse</code> in the <code>Parser</code>, and then looking it up and calling it at <code>fill()</code> time.

<p>
The major effort had to do with decisions about small behavioral corner-cases with the EOF and NUL characters.

<p>
Historically, the EOF character had a fairly traumatic impact on an <code>Input</code>.  If one was encountered, the <code>Input</code> would be put into what could be called &ldquo;EOF mode&rdquo;, where it would only ever again return EOF characters.
I suspect this was fairly robust for the <i>rc</i>-like behavior intended by the authors, but it was noted a long time ago that it prevented the shell from being capable of something like csh&rsquo;s <code>ignoreeof</code>.
For those using the new-style <code>$&amp;parse</code>, it can also lead to surprising behavior, where an EOF generated by the shell&rsquo;s input file descriptor can lead to a reader command later not even being called&mdash;even if the reader command doesn&rsquo;t read from that file descriptor.
So that has now been changed; more discretion is given to the reader command.
Another way that the reader command has more discretion than before is if there is no input file descriptor at <em>all</em>.
Previously, that would immediately trigger an EOF, but now the reader command is called, with its standard input redirected to <code>/dev/null</code> so that it has the chance to produce an EOF or not on its own.

<p>
As far as NUL characters go, that is largely a matter of the <code>$&amp;read</code> primitive.&hellip;


<h2>The <code>$&amp;read</code> and <code>$&amp;readline</code> primitives</h2>

<p>
<i>Es</i> gained the <code>$&amp;read</code> primitive relatively late in its Paul Haahr-implemented era, with the <span class=uppernum>0.9-alpha1</span> release.
As with some other features added during this period, it didn&rsquo;t get much of a chance to be &ldquo;battle tested&rdquo;, which left it relatively unoptimized, and with some small bugs: in particular, it was completely incapable&mdash;to the point of crashing the shell&mdash;of reading NUL bytes.
Because of this, <code>$&amp;read</code> needed some improvements before it could become the primary mechanism for reading shell input.

<p>
The first change was for performance: Historically, <code>$&amp;read</code> would only read one byte at a time, so as to avoid over-reading from a non-seekable file descriptor such as a pipe.
This meant that just reading an eight-kilobyte script (the size of my own <code>.esrc</code> at the time of writing) would require eight thousand <code>read(3)</code> calls, which is a pretty significant inefficiency even with modern kernels and libcs which do their best to cache things.
This was fixed, for seekable file descriptors, by reading into a probably-larger-than-one-line buffer and seeking to the correct character before returning.

<p>
The second change was for NUL bytes.
The crash when <code>$&amp;read</code> encountered a NUL was fixed a year or two ago, but because the goal at the time was to merely fix a crashing bug, it was only replaced with an exception.
This was still insufficient to replace the existing, intentional, tested behavior for shell input, which was to skip any NUL bytes and print a warning to standard error.

<p>
To make this work in a reasonably simple way, I changed <code>$&amp;read</code> so that if it reads a line which contains a NUL character, it splits its return value on that NUL.
This should actually work quite well with things like GNU&rsquo;s <code>find -print0</code>, but also allows skipping the NUL byte or throwing an exception on one.
However, it does create a problem: because reading NUL bytes is rare enough that it caused the shell to crash for decades without anybody bothering to introduce a fix, introducing a <code>%read</code> which <em>almost</em> always returns a list of length zero or one, but <em>rarely</em> returns more, creates a lurking mechanism for issues.
To fix this, <code>%read</code> is written by default to join any lines that have more than one element, effectively adding behavior to skip NULs.
This is reasonably consistent with other shells&rsquo; <code>read</code> builtins, and still allows users to opt into other forms of handling NULs when context demands it.

<p>
The freshly-added <code>$&amp;readline</code> primitive also required some design decisions.
In particular, the major question is this: when working with a standard input which isn&rsquo;t a terminal, what is the best behavior?
Should <code>$&amp;readline</code> still call <code>readline(3)</code>, with all the noisy prompting and echoing that implies, or should it configure readline to behave more like <code>$&amp;read</code>, or should it just fall back to calling <code>$&amp;read</code> directly?

<p>
My expectation is that a user who wants to use readline typically does not want to have the extra mess of readline unless they are reading from a TTY.
This is consistent with the behavior of the shell itself when it implicitly decides whether to be interactive.
Unfortunately, no mechanism currently exists in <i>es</i> to allow a user to test if a file descriptor is a TTY, and I have hesitated to add even more behavior to the shell for the sake of this change.
Because of this, <code>$&amp;readline</code> falls back to <code>$&amp;read</code> if its standard input is not a TTY.
In the future, this should probably be changed so that <code>$&amp;readline</code> is more straightforwardly a wrapper around <code>readline(3)</code>.

<p>
This decision also introduces a small backwards-incompatibility in the shell.
Previously, the following behavior would occur if input was given to <code>es -i</code> on standard input:

<figure>
<pre>
<samp>; </samp><kbd>echo 'echo hello world' | es -i</kbd>
<samp>; echo hello world
hello world
; ; </samp>
</pre>
</figure>

<p>
What&rsquo;s happening here is that, even though this <i>es</i>&rsquo; standard input is not a TTY, because <code>-i</code> has been explicitly provided and its input is the shell&rsquo;s standard input, readline is called; the extra output here is its prompt and the input it reads being echoed to its standard output.

<p>
With the <code>$&amp;readline</code> primitive, that logic has changed.
Instead of calling readline when the shell is interactive and the input is the shell&rsquo;s input, readline is called when the shell is interactive and the input is a TTY.
This only really causes a change in the case given above:

<figure>
<pre>
<samp>; </samp><kbd>echo 'echo hello world' | es -i</kbd>
<samp>hello world
; </samp>
</pre>
</figure>

<p>
Different shells have different behavior in this case, so the old behavior is clearly not a universal requirement, and the TTY-based behavior is easier to explain and reason about without getting into details of shell internals.
However, this is a change, and it marks a change from <i>rc</i>&rsquo;s precedent, so it is worth calling out.


<h2>Performance</h2>

<p>
Despite some of the considerations above, the <em>major</em> downside of the implementation thus far is its impact on shell performance.
This impact is to some degree inevitable, since migrating any behavior from C to <i>es</i> is going to worsen performance.
However, most of it isn&rsquo;t inherent to the change here, but is instead fixable in the long term.

<p>
Some of the changes are internal.  For example, a number of buffers and other bits of state that were previously retained across parser calls are now allocated and freed each time, so with certain workloads, allocations have increased quite a bit.

<p>
Some of the changes are external: previously the shell would read scripts and other non-interactive input in multiple-kilobyte chunks, but now files are read line-by-line, which means that in order to read a script, calls to <code>read(3)</code> and <code>lseek(3)</code> are an order of magnitude more numerous.
Fixing this would require creating a read-in-chunks mechanism in <i>es</i>.
Some experimentation thus far suggests that this is the major factor, and that adding this read-in-chunks mechanism would make most of the performance impact disappear.


<h2>Implications and further work</h2>

<p>
In this post, I avoided describing in too much detail how the shell goes about tracking the shell input&rsquo;s file descriptor.
This is because that tracking is inscrutable, internal shell magic which is arranged by the <code>$&amp;parse</code> primitive.
The new <code>$&amp;parse</code>, just like the old one, uses this internal magic, exposing it to the reader command as its standard input.

<p>
So, while the reader command itself has been exposed to users, all the logic around opening and managing file inputs, remains internal and magic.
In particular, we still can&rsquo;t just use <code>$&amp;parse</code> as a normal function:

<figure>
<pre>
<samp>; </samp><kbd># can you explain the following behavior?</kbd>
<samp>; </samp><kbd>echo 'hello world' | echo &lt;={$&amp;parse $&amp;read}</kbd>
<samp>
; </samp>
</pre>
</figure>

<p>
Exposing these built-in behaviors and making shell input less magical would be a good path forward.
An improvement on the current state of the art would be some mechanism for file descriptors (or, more generally, &ldquo;handles&rdquo;) to be lexically scoped.
This would provide a more robust way to isolate state between different parts of the shell runtime.

<p>
I have been playing around with the idea of &ldquo;variable-bound file handles&rdquo;, a mechanism for opening an internal file descriptor which is bound directly to a variable, not exposing a user-visible file descriptor.
As I imagine it, these handles would be reference-counted and automatically closed when the last variable reference is dropped.
In addition, some metadata could be stored about the handle, such as its filename and, potentially, the current line number; this metadata could effectively eat much of what remains in the shell&rsquo;s magic <code>Input</code> struct.

<p>
The work done on inputs helps make <code>$&amp;parse</code> into a more orthogonal, normal primitive, but it also does the same with the readline library.
Previously, readline was relatively deeply integrated into the input-reading code, and at one point support for <a href="https://man.freebsd.org/cgi/man.cgi?editline">the alternative editline library</a> was dropped, presumably because it was too obnoxious to support its integration alongside that of readline.
Now, everything to do with readline is nearly fully isolated into a single file which defines a few primitives which can be hooked into the shell, plus a few bits of initial.es which do that hooking.

<p>
Formalizing and extending how this readline integration works, and making it into a repeatable pattern for other optional libraries, seems like a promising path forward for the shell.
The idea here would be a mechanism where users could specify a C file which defines a set of primitives, along with an <i>es</i> script which wraps those primitives in functions to integrate into the shell at build time.

<p>
A system like this could reduce the stakes of contributing to upstream <i>es</i> by allowing people to offer code that is only included if opted-into at build time.
Further sophistication could then be developed, such as dynamic runtime primitives using <code>dlopen(3)</code>, and namespacing of primitives to better express notions such as &ldquo;which version of <code>$&amp;parse</code> are you using?&rdquo;
These would make <i>es</i> even more extensible than it is, and would allow a single <i>es</i> binary to be extended to contain more primitives as desired.

<p>
Of course, in addition to all this, there are extensibility improvements that, thanks to this work, are now possible for <code>$&amp;readline</code> itself.
Now that it is possible to run <i>es</i> script while parsing, we can add custom key bindings and a completion hook (or multiple completion hooks, depending on the design).
Programmable completion logic would be useful in its own right, but custom key bindings should also allow for integration with things like <a href="https://github.com/atuinsh/atuin">the funny shell history server atuin</a>, such that iterating through or searching shell history would consult the remote server.
These extensions to <code>$&amp;readline</code> represent the most immediate and significant usability improvement for users of the shell who aren&rsquo;t deep into implementation.


</main>
