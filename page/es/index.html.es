<; cat tmpl/header.html >

<title>jpco.io | A (re-)introduction to the extensible shell</title>
<meta name=description content="Es is the extensible shell.">

<; build-nav /es >

<main>
<h1>A (re-)introduction to the extensible shell</h1>
<div class=time><time datetime=2026-02-16>2026-02-16</time></div>

<p>
I am excited to announce that version 0.10.0 of <i>es</i>, the extensible shell, has been released.

<p>
This is the first release of <i>es</i> in almost four years, and the first time the release hasn&rsquo;t started with 0.9 in over three <em>decades</em>.
So, while this release doesn&rsquo;t contain any profound changes to the language or interpreter, it should be taken as a signal that something has changed in <i>es</i>, and that right now is a great time to try picking it up.

<p>
For those not already familiar with it, the best introductions to <i>es</i> are <a href=/es/paper.html>the original paper</a> presented at Usenix 1993 or the <a href=/es/man.html>man page</a>, but I&rsquo;ll provide a shorter, incomplete introduction to the shell here, the state of the shell after its over three decades of existence, and some ideas on what interesting work there still is to be done.

<p>
The current version of <i>es</i> is hosted on <a href="https://github.com/wryun/es-shell">the GitHub repository</a>.
It is written in ANSI C, though a <a href=/es/runtime-quirks.html>somewhat quirky form of C</a> due to some extensive preprocessor macro use to implement some of its features.
It should successfully build with any ANSI C compiler and it should successfully run on any OS which implements a reasonable portion of the POSIX.1-2001 standard.

<h2>What is <i>es</i>?</h2>

<p>
<i>Es</i> is a Unix shell first developed in the early 1990s by Byron Rakitzis and Paul Haahr, based directly on <a href="https://github.com/rakitzis/rc">Rakitzis&rsquo; earlier port of the shell <i>rc</i></a> from Plan 9 to Unix.
To quote the 1993 <i>es</i> Usenix paper:

<blockquote>
[w]hile rc was an experiment in adding modern syntax to Bourne shell semantics, es is an exploration of new semantics combined with rc-influenced syntax: es has lexically scoped variables, first-class functions, and an exception mechanism, which are concepts borrowed from modern programming languages such as Scheme and ML.
</blockquote>

<p>
Simple <i>es</i> commands closely resemble other shells, with familiar syntax for things such as pipes, redirections, <code>$variables</code>, wildcards, and backgrounding.
These things should be especially familiar for those experienced with <i>rc</i>.

<figure>
<pre>
<code>make -p &gt;[2] /dev/null | grep -o '^[^#].*:'</code>
</pre>
</figure>

<p>
Also like in <i>rc</i>, all <i>es</i> variables are flat lists, and a variable&rsquo;s value is never split or otherwise mangled unless a specific command like <code>eval</code> is invoked to do just that.
This makes the common experience of using variables much more natural than in Bourne-derived shells.

<figure>
<pre>
<samp>; </samp><kbd>args = -l 'Long Document.pdf'</kbd>
<samp>; </samp><kbd>ls $args</kbd>
<samp>-rw-r--r-- 1 jpco jpco 12345 Aug 31 15:44 'Long Document.pdf'</samp>
</pre>
</figure>

<p>
Where <i>es</i> differs from <i>rc</i> is in its influence from functional programming.
In particular, from Scheme, <i>es</i> draws features like higher-order functions and lexical scope.

<figure>
<pre>
<code>fn map cmd args {
	for (i = $args)
		$cmd $i
}
map @ i {cd $i; rm -f *} /tmp /var/tmp</code>
</pre>
</figure>

<p>
In this example, <code>@ i {cd $i; rm -f *}</code> is a <em>lambda expression</em>&mdash;an anonymous, inline function&mdash;which takes an argument <code>i</code>, <code>cd</code>s to the directory named in <code>$i</code>, and then <code>rm -f</code>s everything in the directory.
Blocks of code (&ldquo;code fragments&rdquo; in <i>es</i>-speak), represented as <code>{commands in curly braces}</code>, can also be passed around in variables or passed as arguments to functions.
These blocks of code function like lambda expressions, except that they bind no arguments.

<figure>
<pre>
<samp>; </samp><kbd>var = {echo first} {echo second}</kbd>
<samp>; </samp><kbd>$var(1)  # invoke the first element of $var</kbd>
<samp>first
; </samp><kbd>$var(2)  # invoke the second element of $var</kbd>
<samp>second</samp>
</pre>
</figure>

<p>
Many constructs within <i>es</i> are implemented as functions which take lambda expressions and/or code fragments as arguments.
For example, the builtin command <code>catch</code>, which is core to <i>es</i>&rsquo; exception mechanism, takes a lambda expression for its catcher, and a code fragment for its body.

<figure>
<pre>
<code>catch @ e {        # this is the start of the catcher lambda argument
	echo caught $e
} {                # this is the start of the body code fragment argument
	if {!rm $file} {
		throw error rm could not remove file
	}
}</code>
</pre>
</figure>

<p>
Because so many behaviors in <i>es</i> are modeled internally as function calls, the internals of the shell are easily visible and changeable.
The following shows how pipes are implemented: when parsed, the <code>|</code> syntax is desugared into a call to the <code>%pipe</code> function, and the <code>%pipe</code> function is itself just a call to the <code>$&amp;pipe</code> <em>primitive</em>, the built-in function which performs the behavior.

<figure>
<pre>
<samp>; </samp><kbd>echo {ls | wc -l}</kbd>
<samp>{%pipe {ls} 1 0 {wc -l}}
; </samp><kbd>echo $fn-%pipe</kbd>
<samp>$&amp;pipe
</pre>
</figure>

<p>
With this knowledge, the definition of <code>%pipe</code> can be changed to add custom, extended behaviors, a practice refered to in <i>es</i> parlance as <em>spoofing</em>.  A classic example of spoofing, adapted from the Usenix paper, is extending <code>%pipe</code> to time each pipeline command individually.

<figure>
<pre>
<samp>; </samp><kbd>cat pipehook.es</kbd>
<samp>fn %pipe {
	let (args = ()) {
		for ((c i o) = $*)
			args = $args {time $c} $i $o
		$&amp;pipe $args
	}
}
$*
; </samp><kbd>es pipehook.es {cat page/es/paper.html.es | tr -cs a-zA-Z0-9 '\012' | sort | uniq -c | sort -nr | sed 6q}</kbd>
<samp> 0.001r   0.000u   0.000s	{cat page/es/paper.html.es}
 0.001r   0.000u   0.000s	{tr -cs a-zA-Z0-9 '\012'}
 0.005r   0.004u   0.001s	{sort}
 0.006r   0.001u   0.000s	{uniq -c}
    367 a
    302 the
    286 i
    266 code
    165 to
    162 of
 0.007r   0.001u   0.000s	{sed 6q}
 0.007r   0.002u   0.000s	{sort -nr}</samp>
</pre>
</figure>

<p>
Spoofing lets users redefine large swaths of the shell&rsquo;s internal behavior.
For example, the <code>%write-history</code> function is called by the shell to write a command to the shell history after reading it.
To make the shell avoid writing duplicate commands to history, one can simply redefine the function as follows:

<figure>
<pre>
<code>let (write = $fn-%write-history; last-cmd = ())
fn %write-history cmd {
	if {!~ $cmd $last-cmd} {
		$write $cmd
		last-cmd = $cmd
	}
}</code>
</pre>
</figure>

<p>
We can go through this example line-by-line.

<ol>
<li>
<p>
<code>let (write = $fn-%write-history; last-cmd = ())</code>

<p>
This creates a (lexical) binding of the current definition of <code>%write-history</code> to the variable <code>write</code>, and of <code>()</code>&mdash;the empty list&mdash;to the variable <code>last-cmd</code>.

<li>
<p>
<code>fn %write-history cmd {</code>

<p>
This creates a new definition of <code>%write-history</code> with one parameter, <code>$cmd</code>.
Thanks to the <code>write</code> variable bound with the <code>let</code> in the previous line, the old definition of <code>%write-history</code> is accessible within the body of this function.
This is a very common idiom in <i>es</i>, because it allows multiple spoofs of a single function to &ldquo;stack&rdquo; with one another with little difficulty.

<p>
Note also that when the <code>last-cmd</code> variable was bound, the binding was created outside of this function.
That means the binding, and therefore the value of <code>last-cmd</code>, persists across function calls.

<li>
<p>
<code>if {!~ $cmd $last-cmd} {</code>

<p>
This compares <code>$cmd</code> against <code>$last-cmd</code>.
If they differ, then...

<li>
<p>
<code>$write $cmd</code>

<p>
We call the previous definition of <code>%write-history</code> on our new <code>$cmd</code>.

<li>
<p>
<code>last-cmd = $cmd</code>

<p>
Then, we set <code>last-cmd</code> to <code>$cmd</code>.
Because <code>last-cmd</code> persists across calls to <code>%write-history</code>, this saves this value to compare against future values of <code>$cmd</code>.

</ol>

<p>
This bit of code implements what in Bash would be achieved using <code>HISTCONTROL=ignoredups</code>, and it&rsquo;s reasonable to note that for this specific case, the Bash version is quite a bit more concise and easier to configure than the <i>es</i> version is to script up.

<p>
But that&rsquo;s because this is a specific feature, one of a great many, that has been pre-implemented in Bash.
<code>HISTCONTROL</code> is a colon-separated (<code>$PATH</code>-style) list which can contain one of a few special, hardcoded tokens, which correspond with particular behaviors around writing shell history (an exercise for the reader: without looking it up, what are all the possible tokens?)
It is semi-redundant with another special variable, <code>HISTIGNORE</code>, which controls yet further behaviors, configured using a different kind of colon-separated (<code>$PATH</code>-style) list, with syntax unique to the <code>HISTIGNORE</code> variable (More exercises for the reader: without looking it up, what is that syntax?  In what cases are <code>HISTCONTROL</code> and <code>HISTIGNORE</code> redundant?  In those cases, which is preferable to use?)
There is a lot to know about these two variables.

<p>
<i>Es</i> takes a different approach instead.
There is more knowledge required to hand-write the equivalent of <code>HISTCONTROL=ignoredups</code>, but most of that knowledge is general: spoofing functions, saving state across function calls, comparing values.
These are some of the tools of <i>es</i> scripting; once somebody is proficient in writing <i>es</i> scripts, they&rsquo;re proficient in customizing <i>es</i>.

<p>
The <i>es</i> approach also enables a fundamentally greater degree of flexibility, because an <i>es</i> function can do anything <i>es</i> can do.
When Paul and Byron exposed the shell&rsquo;s interactive REPL as the function <code>%interactive-loop</code>, they also exposed the non-interactive REPL as <code>%batch-loop</code>, despite having reservations that actually modifying the non-interactive REPL would ever be a good idea.
Doing so, however, made it possible to write an alternate version of <code>%batch-loop</code> that parses an entire script before running any of its commands, which is a convenient way to &ldquo;sanity-check&rdquo; code and avoid running half of a buggy script.

<p>
This degree of flexibility is remarkable: this kind of pre-parsing was never implemented or even considered by the authors of <i>es</i>, but it&rsquo;s just as possible as it is under other shells which <a href="https://elv.sh/ref/language.html#code-chunk">officially advertise the behavior</a>.

<h2>What&rsquo;s been happening with <i>es</i>?</h2>

<p>
<i>Es</i> was mostly developed over the course of 1992-1995.
The bulk of development went through the release of version 0.84; 0.88 was released after the authors had taken a break, and then after that release both of them got too busy with life and jobs to continue work on the shell.

<p>
After that, maintainership passed through a couple hands, leading eventually to the current maintainer James Haggerty, but that maintainership was largely focused on keeping <i>es</i> basically functional over the decades as OSes, build systems, and code-hosting practices have evolved.

<p>
This left <i>es</i> as an incomplete experiment: Paul and Byron didn&rsquo;t have time to achieve a good amount of what they planned on, and even if they had, their near- to medium-term plans certainly didn&rsquo;t sum up to everything the shell could be made to do.

<p>
Recently, however, there has been more activity, which has just been bundled up in version 0.10.0.
This new version of <i>es</i> is not significantly different as a language from prior versions, but it contains a good number of bug fixes.
Something like 20 PRs have been merged to fix different ways to crash the shell, and each way now has automated regression testing run on every new PR written.
Portability has also been significantly improved, as obsolete portability-oriented code has been removed and the <i>es</i> runtime has been moved onto the very widely-supported functions in the POSIX.1-2001 standard.

<p>
There has also been a large collection of small improvements: <a href="https://tiswww.case.edu/php/chet/readline/rltop.html">readline</a> integration is better, supporting variables and primitives, and writing to history has been tweaked.
Most left-over implications of assignments returning the assigned value have been tidied up.
Waiting, process group handling, and terminal assignment have all been fixed up to be made more predictable, as has signal handling.

<p>
One other change is the addition of &ldquo;canonical extension&rdquo; scripts.
These are scripts distributed (and installed) with <i>es</i>, not built into the shell itself, but available as officially supported implementations of certain spoofs.
The initial canonical extensions are

<ul>
<li><code>autoload.es</code>, which adds a function-autoloading mechanism.
<li><code>cdpath.es</code>, which adds <i>rc</i>-style cdpath handling.
<li><code>interactive-init.es</code>, which adds a hook function <code>%interactive-init</code> which can be used to run commands at the start of an interactive shell.
<li><code>path-cache.es</code>, which adds path-caching behavior like some shells&rsquo; &ldquo;hash&rdquo; builtins.
<li><code>status.es</code>, which creates a <code>$status</code> variable which is automatically set to the last command&rsquo;s return value in interactive shells.
</ul>

<p>
In addition, there has been some refactoring of the internals in order to support larger near-term changes&hellip;

<h2><i>Es</i> futures</h2>

<p>
So, what&rsquo;s next for <i>es</i>?
Well, there are a couple of near-term goals I would like to achieve.

<p>
I would like to improve how shell input is read and parsed.
<i>Es</i> has long had support for readline, but that support is limited, because while the parser is running, the shell can&rsquo;t run commands written in <i>es</i> script&mdash;only hardcoded behavior.
Some work that has been recently done with how parser memory is managed changes this, and will enable things like programmable tab completion, or even swapping out readline for other libraries entirely.
Given that there are multiple <i>es</i> forks featuring custom, hand-rolled line editing libraries, making this easier to swap out seems like meeting an active desire of users.

<p>
I would also like to add some form of support for job control to the shell.
There is a long history of religious arguments about job control in both <i>es</i> and <i>rc</i>, and I admit that I find many shells&rsquo; abstraction of a &ldquo;job&rdquo; to be more obnoxious than useful.
However, managing process groups, which is the core of job control, is something that should be possible for any competent Unix shell, and I believe that it can be possible for <i>es</i> with small extensions to existing shell mechanisms; particularly, the <code>$&amp;newpgrp</code> and <code>$&amp;wait</code> primitives.
Once that support is added, then a simple <code>job-control.es</code> script can be easily added as a canonical extension.

<p>
Both of these ideas, programmable input and job control, are in large part in service of a larger goal, which is to grow the <i>es</i> community.
<i>Es</i>, I think, has real design strengths which have appealed to people like myself even despite other limitations of the shell, and during periods when development was stalled.
Removing those limitations and allowing people to interact with their shell in ways that are familiar to them (that is, job control and fancy programmable input), and managing to do so in ways that are consistent with the shell&rsquo;s existing design, serves to both make the shell more practically useful and demonstrate that its design works.

<p>
Ideally though, I don&rsquo;t want to add too much to what&rsquo;s built into the upstream <i>es</i>.
The current feature set is pretty good, and I think it&rsquo;s right to have a shell that starts small and lets users build on that, rather than the other way around.
Whatever is added to the core, upstream shell should function as a sort of meta feature, enabling not just this or that particular use but a whole kind of extensibility or programmability.

<p>
Outside of actual development work, I intend to write more posts to document aspects of <i>es</i>, making it easier to get a strong grasp of the shell without having to dive into the codebase or trawl the old mailing list just to have an idea of how certain things work or why they&rsquo;re implemented the way they are.

<p>
Some pages I ought to get around to writing include:
<ul>
<li>Job control and the extensible shell
<li>Effective <i>es</i> scripting
<li>The life of an <i>es</i> command
<li>The <i>es</i> runtime
<li>Extensible shell input
<li>Exceptions in <i>es</i>
</ul>

<p>
All in all, I&rsquo;d like to help build a solid enough foundation for <i>es</i>, along with documentation and tooling support, that it lowers the barrier to entry for hacking on the shell significantly.
Over the years, while the upstream shell has been quiet, multiple individual forks have spun up, proving that motivation to do things with <i>es</i> has never really gone away, even if it has been disorganized.
If upstream <i>es</i> can better avoid all that effort hitting dead-ends in defunct personal forks, that would be fantastic for the shell and its community.

<p>
I believe that the continuing endurance of <i>es</i> is directly due to the fact that, even as an old and incomplete experiment, it is still a shining example of software design.
It is simple, powerful, and predictable; it can be used to <a href=/es/web-server.html>host a web site</a> or <a href=/es/desktop.html>function at the core of a desktop</a>.
<i>Es</i> is an elegant piece of software that I&rsquo;m happy to use every day.

</main>
