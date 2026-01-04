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
The best (if slightly out-of-date) introductions to the shell are <a href=/es/paper.html>the original <i>es</i> paper</a> presented at Usenix 1993 or the <a href=/es/man.html><i>es</i> man page</a>, but I'll provide a shorter, incomplete introduction to the shell here, the state of the shell after three decades, and some ideas on what interesting work there is left to be done.

<p>
The current version of <i>es</i> is hosted on <a href="https://github.com/wryun/es-shell">the GitHub repository</a>.
It is written in ANSI C, with some <a href=/es/runtime-quirks.html>somewhat unique quirky aspects</a> to its codebase.
It should be portable to any OS which implements the POSIX.1-2001 standard.

<h2>What is <i>es</i>?</h2>

<p>
<i>Es</i> is a Unix shell first developed in the early 1990s by Byron Rakitzis and Paul Haahr, based directly on <a href="https://github.com/rakitzis/rc">Rakitzis' earlier port of the shell <i>rc</i></a> from Plan 9 to Unix.
As the paper puts it,

<blockquote>
[w]hile rc was an experiment in adding modern syntax to Bourne shell semantics, es is an exploration of new semantics combined with rc-influenced syntax: es has lexically scoped variables, first-class functions, and an exception mechanism, which are concepts borrowed from modern programming languages such as Scheme and ML.
</blockquote>

<p>
Simple <i>es</i> commands closely resemble other shells, with pipes, redirections, <code>$variables</code>, wildcards, backgrounding, and more. Redirection syntax particularly resembles <i>rc</i>.

<figure>
<pre>
<code>make -npq &gt;[2] /dev/null | grep '.*:'</code>
</pre>
</figure>

<p>
Also like <i>rc</i>, <i>es</i> has list-typed variables, no implicit rescanning, and no double quotes.
These together make variables significantly more straightforward to use than in POSIX-compatible shells.

<figure>
<pre>
<samp>; </samp><kbd>args = -l 'Long Document.pdf'</kbd>
<samp>; </samp><kbd>ls $args</kbd>
<samp>-rw-r--r-- 1 jpco jpco 12345 Aug 31 15:44 'Long Document.pdf'</samp>
</pre>
</figure>

<p>
From Scheme, <i>es</i> draws features like first-class functions and lexical scope.

<figure>
<pre>
<code>fn map cmd args {
  for (i = $args)
    $cmd $i
}
map @ i { cd $i; rm -f * } /tmp /var/tmp</code>
</pre>
</figure>

<p>
In this example, <code>@ i { cd $i; rm -f * }</code> is a <em>lambda expression</em>&mdash;an inline function&mdash;which takes an argument <code>i</code>, <code>cd</code>s to it, and then <code>rm -f</code>s everything in the directory.

<p>
Nearly everything in <i>es</i> is a function under the hood, and functions are just variables whose names start with <code>fn-</code>.
Like other variables, functions can be redefined.

<figure>
<pre>
<samp>; </samp><kbd>echo {command &gt; file}</kbd>
<samp>{%create &lt;={%one file} {command}}
; </samp><kbd>echo $fn-%create</kbd>
<samp>%openfile w
; </samp><kbd># this is not very useful</kbd>
<samp>; </samp><kbd>fn-%create = echo</kbd>
<samp>; </samp><kbd>command &gt; file</kbd>
<samp>1 file {command}</samp>
</pre>
</figure>

<p>
This lets users redefine large swaths of the shell's behavior.
For example, the <code>%write-history</code> function is called by the shell to write a command to history after reading it.
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
This creates a lexical binding of the variable <code>write</code> to the current definition of <code>%write-history</code>, and of the variable <code>last-cmd</code> to <code>()</code> (the empty list).

<li>
<p>
<code>fn %write-history cmd {</code>

<p>
This creates a new definition of <code>%write-history</code>.
Thanks to the <code>write</code> variable bound with the <code>let</code> in the previous line, the old definition of <code>%write-history</code> is accessible within this function.
This is a very common idiom in <i>es</i>, used for &ldquo;spoofing&rdquo; functions, or creating new definitions to suit preferences or create situational benefit.

<p>
That <code>let</code> also bound the <code>last-cmd</code> variable; it's only bound to the empty list initially, but because that binding is created outside the body of the function, its value will persist across calls.

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
After that, maintainership passed through a couple hands, leading eventually to the current maintainer James Haggerty, but development was largely focused on keeping <i>es</i> functional and available over the decades as OSes, build systems, and code-hosting practices have evolved.

<p>
This has left <i>es</i> as an incomplete experiment: Paul and Byron didn't have time to achieve a good amount of what they planned on, and even if they had, their near- to medium-term plans certainly didn't sum up to everything the shell could be made to do.

<p>
However: at its core <i>es</i> has a simple and powerful design which removes a huge amount of the friction of shell scripting.
Its ethos of providing fewer and more powerful language and runtime mechanisms makes it relatively easy to know top to bottom, and surprisingly easy to modify its internals.
It is, genuinely, an extremely elegant piece of software that I am very glad to use every day.

<h2><i>Es</i> futures</h2>

<p>
So what would best be done with <i>es</i> now?

<p>
There are a few major themes where I would like to see improvement, and would be willing to dedicate effort to make that happen.

<p>
First of all, I would love to get more users of the shell.
As more people use <i>es</i>, more creativity is applied to using and customizing it, and benefits of its flexibility compound.
Packaging <i>es</i> for more OSes and Linux distros will help, as would more writing about the shell and more documentation online.

<p>
Quite a bit of existing knowledge about <i>es</i> is wrapped up inside the old mailing list or the source code, and users shouldn't be reasonably expected to dig around git commit history or years worth of old mail archives to understand a piece of software enough to use it effectively.

<p>
Tooling support would be helpful as well; syntax highlighting for popular editors, maybe even some kind of LSP integration (cf. Elvish), as well as reviving (and documenting) the <code>esdebug</code> script.

<p>
I would also like to close the gaps where <i>es</i> is unable to perform common shell behaviors today.
It's not wrong for <i>es</i> to be small and minimal by default, but a shell that's supposedly extensible should be able to support, say, job control, or customizable interactive behaviors.

<p>
I am also interested in pushing <i>es</i>' extensibility even further.
While the shell is already extensible, some major chunks of the shell are hard-coded in ways that they don't have to be; for example, <a href="https://github.com/wryun/es-shell/pull/79">most of the existing main() function could be scripted within the shell</a>.

<p>
The primitives which back most <i>es</i> commands can also be made extensible through dynamic library loading, which has been well standardized and is supported across Unices.
This would allow the shell to perform novel and OS-specific behaviors, like interacting with networks, performing <a href="https://www.haiku-os.org/blog/humdinger/2017-11-05_scripting_the_gui_with_hey/">GUI scripting</a>, or <a href="https://wiki.freebsd.org/Capsicum">sandboxing chunks of scripts</a>.
Careful design around versioning could also enable a good backwards-compatibility story without hamstringing the shell's ability to change over time.

<p>
There is a lot of opportunity to make improvements to the runtime to support all of the above, as well as to make the shell faster to run.
<i>Es</i> was never optimized in either runtime or memory to a meaningful degree, so there is significant low-hanging fruit there.

<p>
In particular, drawing from the rich tradition of Scheme interpretation methods could enable powerful things like tail-call optimization, better exception support without <code>setjmp(3)</code>/<code>longjmp(3)</code> (enabling better cross-language interaction), more efficient memory use, improved speed, and even features like continuations or lightweight threading.

<h2>To write</h2>
<ul>
<li>Job control and the extensible shell
<li>Effective <i>es</i>
<li>The shell-forward desktop
<li>Serving a website with a shell script is fun and easy
</ul>
</main>
