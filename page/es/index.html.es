<; cat tmpl/header.html >

<title>jpco.io | A (re-)introduction to the extensible shell</title>
<meta name=description content="Es is the extensible shell.">

<; build-nav /es >

<main>
<h1>A (re-)introduction to the extensible shell</h1>
<div class=time><time datetime=2025-08-30>2025-08-30</time></div>

<p>
<i>Es</i> is the extensible shell.

<p>
The best (if slightly out-of-date) introductions to the shell are <a href=/es/paper.html>the original <i>es</i> paper</a> presented at Usenix 1993 or the <a href=/es/man.html><i>es</i> man page</a>, but I'll provide a shorter, incomplete introduction to the shell here, the state of the shell after three decades of existence, and some ideas on what interesting work there still is to be done.

<p>
The current version of <i>es</i> is hosted on <a href="https://github.com/wryun/es-shell">the GitHub repository</a>.
It is written in ANSI C, though a <a href=/es/runtime-quirks.html>somewhat quirky form</a> due to some extensive preprocessor macro use implementing some of its features.
It should be portable to any OS which implements a reasonable portion of the POSIX.1-2001 standard.

<h2>What is <i>es</i>?</h2>

<p>
<i>Es</i> is a Unix shell first developed in the early 1990s by Byron Rakitzis and Paul Haahr, based directly on <a href="https://github.com/rakitzis/rc">Rakitzis' earlier port of the shell <i>rc</i></a> from Plan 9 to Unix.
As the Usenix paper puts it,

<blockquote>
[w]hile rc was an experiment in adding modern syntax to Bourne shell semantics, es is an exploration of new semantics combined with rc-influenced syntax: es has lexically scoped variables, first-class functions, and an exception mechanism, which are concepts borrowed from modern programming languages such as Scheme and ML.
</blockquote>

<p>
Simple <i>es</i> commands closely resemble other shells, with the typical syntax for things such as pipes, redirections, <code>$variables</code>, wildcards, and backgrounding. The redirection syntax particularly resembles <i>rc</i>.

<figure>
<pre>
<code>make -p &gt;[2] /dev/null | grep -o '^[^#].*:'</code>
</pre>
</figure>

<p>
Also like <i>rc</i>, <i>es</i> has list-typed variables, no automatic rescanning, and no double quotes.
These together make variables significantly more straightforward to use than in POSIX-compatible shells.

<figure>
<pre>
<samp>; </samp><kbd>args = -l 'Long Document.pdf'</kbd>
<samp>; </samp><kbd>ls $args</kbd>
<samp>-rw-r--r-- 1 jpco jpco 12345 Aug 31 15:44 'Long Document.pdf'</samp>
</pre>
</figure>

<p>
Where <i>es</i> differs from <i>rc</i> is in its influence from functional languages.
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
In this example, <code>@ i {cd $i; rm -f *}</code> is a <em>lambda expression</em>&mdash;an inline function&mdash;which takes an argument <code>i</code>, <code>cd</code>s to the directory named in <code>$i</code>, and then <code>rm -f</code>s everything in the directory.
Blocks of code (&ldquo;code fragments&rdquo;) can also be passed around in variables, represented as <code>{commands in curly braces}</code>.
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


<p>
Nearly everything in <i>es</i> is a function under the hood, and functions are just variables whose names start with the prefix <code>fn-</code>.

<figure>
<pre>
<samp>; </samp><kbd>echo {ls | wc -l}</kbd>
<samp>{%pipe {ls} 1 0 {wc -l}}
; </samp><kbd>echo $fn-%pipe</kbd>
<samp>$&amp;pipe
</pre>
</figure>

<p>
This lets users redefine large swaths of the shell's behavior.
For example, the <code>%write-history</code> function is called by the shell to write a command to the shell history after reading it.
To make the shell avoid writing duplicate commands to history, one can write:

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
This creates a new definition of <code>%write-history</code>.
Thanks to the <code>write</code> variable bound with the <code>let</code> in the previous line, the old definition of <code>%write-history</code> is accessible within this function.
This is a very common idiom in <i>es</i>, used for &ldquo;spoofing&rdquo; functions, or creating new definitions to suit preferences or create situational benefit.

<p>
Note also that when the <code>last-cmd</code> variable was bound, the binding was created outside of this function.
That means the binding, and therefore the definition of <code>last-cmd</code>, exists across function calls.

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
We call the old <code>%write-history</code> on the new <code>$cmd</code>.

<li>
<p>
<code>last-cmd = $cmd</code>

<p>
Then, we set <code>last-cmd</code> to <code>$cmd</code>.
Because <code>last-cmd</code> persists across function calls, this effectively saves this command for future calls.

</ol>

<p>
This bit of code implements what in Bash would be achieved using <code>HISTCONTROL=ignoredups</code>, and it's reasonable to note that the Bash version is quite a bit more concise than the <i>es</i> one.
However, the <i>es</i> method has its own major benefits &ldquo;at scale&rdquo;, when considering shell features in aggregate.

<p>
Bash, and many other shells, add behaviors and customization via special variables and options, with their own special values and little languages, requiring a good deal of memorization of a large &ldquo;menu&rdquo; of tweaks and tricks to make the shell work as desired.

<p>
<i>Es</i> takes a different approach instead, exposing the core behaviors of the shell in a way that allows customization using the same scripting techniques that would, largely, be used for anything else in the shell.
Once somebody is proficient in writing <i>es</i> scripts, they're proficient in customizing <i>es</i>.

<p>
The <i>es</i> approach also enables a fundamentally greater degree of flexibility.
When Paul and Byron exposed the shell's interactive REPL as the function <code>%interactive-loop</code>, they also exposed the non-interactive REPL as <code>%batch-loop</code>, despite having reservations that actually modifying the non-interactive REPL would ever be a good idea.
Doing so, however, makes it possible to write an alternate version of <code>%batch-loop</code> that parses an entire script before running any of its commands, which is a convenient way to &ldquo;sanity-check&rdquo; code and avoid running just half of a buggy script.

<p>
This degree of flexibility is remarkable: this kind of pre-parsing was never implemented or even considered by the authors of <i>es</i>, but it's just as possible as it is under other shells which <a href="https://elv.sh/ref/language.html#code-chunk">officially advertise the behavior</a>.


<h2>What's been happening with <i>es</i>?</h2>

<p>
<i>Es</i> was mostly developed over the course of 1992-1995.
The bulk of development went through the release of version 0.84; 0.88 was released after the authors had taken a break, and then after that release both of them got too busy with life and jobs to continue work on the shell.

<p>
After that, maintainership passed through a couple hands, leading eventually to the current maintainer James Haggerty, but development was largely focused on keeping <i>es</i> functional over the decades as OSes, build systems, and code-hosting practices have evolved.

<p>
This left <i>es</i> as an incomplete experiment: Paul and Byron didn't have time to achieve a good amount of what they planned on, and even if they had, their near- to medium-term plans certainly didn't sum up to everything the shell could be made to do.

<p>
Recently, however, there has been more activity.
A few of us have worked over the last year or two largely to shore up <i>es</i>' portability and reliability, including adding a test suite and supporting stricter compiler flags as well as more static analysis tools.

<h2><i>Es</i> futures</h2>

<p>
So what's next for <i>es</i>?
Well, there are a couple active projects I am pursuing.

<p>
Near-term, I would like to improve how <i>es</i> reads commands from its input.
<i>Es</i> currently can be built with support for <a href="https://tiswww.case.edu/php/chet/readline/rltop.html">readline</a>, but that support is somewhat limited&mdash;things like programmable tab completion simply can't be achieved.
Some work in how memory is managed should enable things like programmable tab completion or even swapping out readline for other libraries entirely.
Given there are multiple <i>es</i> forks featuring custom, hand-rolled line editing capabilities, making this easier to swap out seems ideal.

<p>
I would also like to add some form of job control to the shell.
There is a long history of fighting job control in both <i>es</i> and <i>rc</i>, but I believe that it can be done in a way where, with a little more flexibility added to existing behaviors, users can handle process groups effectively and build a job-control system of their own.

<p>
Both of these projects are at least in part in the service of a somewhat larger goal, which is to grow the <i>es</i> community.
<i>Es</i>, I think, has real design strengths which have appealed to people (like myself) even during periods when development on the shell was stalled.
The several individual forks of <i>es</i> demonstrate this&mdash;but, in my opinion, those forks are also unfortunate, as they don't contribute to the <i>es</i> project as a whole.

<p>
Allowing people to interact with their shell in ways that are familiar to them (that is, job control and fancy programmable input), and doing so in ways that are consistent with or even extend the shell's existing design, serves to both make the shell more practically useful and demonstrate its design works.

<p>
Ideally though, I don't want to add too much to upstream <i>es</i>.
The current feature set is pretty good.
Whatever is added should function as a sort of meta feature, enabling not only some particular use but a whole new category of extensibility.

<p>
This is why, for example, I'm not just interested in adding programmable readline completion, but making it so that input to the shell is <em>completely</em> programmable.
This extends the existing <i>es</i> tendency of making internal shell behaviors external, complementing <code>%interactive-loop</code> and <code>%batch-loop</code>, but also makes it more feasible to do things like call readline in other contexts, or write other line-editing libraries which can read input in other ways.

<p>
In addition to extensibility, I would like to try to follow through a bit on <i>es</i>' programmability.
A couple examples here include:
<ul>
<li>replacing the current <code>-e</code> behavior, which functions similarly to other shells, exiting if any command returns falsey, with a behavior where any false results are instead thrown as exceptions.
<li>enabling handling files in a style more like &ldquo;real&rdquo; programming languages do, in addition to the current shell-style file handling.
</ul>

<p>
Lastly, I would like to write more things to document aspects of <i>es</i>, making it easier to get a strong grasp of the shell without having to dive into the code itself or trawl the old mailing list just to have an idea of how certain things work or why they were implemented the way they were.

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
All in all, I'd like to have a good enough foundation for <i>es</i>, along with documentation and tooling support, that people can really get to hacking on it.
Over the years, while the upstream shell has been quiet, multiple forks have spun up, proving that motivation to do something with <i>es</i> has never gone away.

<p>
And, to me, it makes a ton of sense why.  At its core, es has a simple and powerful design which removes a huge amount of the friction of shell scripting, which is otherwise one of the most powerful ways to use a computer.
<i>Es</i>' ethos of providing a few powerful and orthogonal language and runtime mechanisms makes it relatively easy to know top to bottom, and surprisingly easy to modify its internals.
It is, genuinely, an extremely elegant piece of software that <a href=/es/desktop.html>I am very glad to use every day</a>.

</main>
