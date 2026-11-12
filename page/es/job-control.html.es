<; cat tmpl/header.html >

<title>jpco.io | Job control and the extensible shell</title>
<meta name=description content="A discussion of job control and how it might be implemented within the extensible shell es.">

<; build-nav >

<main>
<h1>Job control and the extensible shell</h1>
<div class=time><time datetime=2026-11-12>2026-11-12</time></div>

<blockquote cite="http://wryun.github.io/es-shell/mail-archive/msg00133.html">
if someone comes to me and Byron and says, ``i need these two extra primitives and this one extra line of conditionally compiled code in signal.c and i'll then be able to write full csh-style job control in es,'' we'd probably put it in, albeit with some serious grumbling. (i don't think it will happen, though. it just don't look that easy to me.)
</blockquote>
<p>&mdash; Paul Haahr, <a href="http://wryun.github.io/es-shell/mail-archive/msg00133.html">21 Oct 1992 mailing list post</a></p>

<p>
Not a lot of people understand job control very well, but a lot of people do seem to rely on it in one way or another.
This has been an unfortunate combination for <i>es</i>: many, many requests for job control have been made, and a few brave souls have implemented versions of it in private forks over the years, but none of those versions have been upstreamed.

<p>
Part of the challenge is cultural.
<i>Es</i>, due to its <i>rc</i> heritage, comes from a community which values minimalism and good design, and <em>hates</em> job control.
After all, Plan 9 lacks job control; instead, as the argument goes, the windowing system provides the same sort of abilities in a better way.

<p>
Part of the challenge with job control and <i>es</i> is, however, technical; the design of <i>es</i> is sufficiently unique that job control can&rsquo;t simply be bolted onto it without some original thought, and none of the attempts at job control thus far have done a good job of integrating it into the way that <i>es</i> does things.
In particular, the following good design practices for <i>es</i> should be followed:

<ul>
<li>New behavior should be added by generalizing existing features, rather than adding new ones
<li>Extensibility should happen by overloading hook functions, rather than by toggling pre-defined options and magic variables
<li>Features should be generally useful, including to those who don&rsquo;t opt into job control
<li>Features should be orthogonal to each other: if job control requires several additions, each of those additions should be understandable and useful on its own
</ul>

<p>
I believe I have a design for job control which achieves all of these reasonably well and deserves to be upstreamed into <i>es</i>.


<h2>Background: What is job control?</h2>

<p>
What is job control?
What specific behaviors are necessary to say that job control is supported?

<p>
There are two answers to this question, in a sense.
The term &ldquo;job&rdquo; won&rsquo;t show up anywhere in the <code>strace</code> of a job-controlling shell.
This is because job control is a <em>feature</em>, which predates the contemporary operating system mechanisms which implement it.

<p>
Job control was <a href="https://docs-archive.freebsd.org/44doc/usd/04.csh/paper-2.html#section17">first introduced with csh</a> way back in the late &rsquo;70s.
The purpose of the feature is to allow users to control commands while they&rsquo;re running.
This includes, as advertised in the csh paper:

<ul>
<li>Running a command in the background with <code>&amp;</code>
<li>Stopping the current foreground command by typing the <code>^Z</code> character
<li>Restarting a stopped command in the foreground with the <code>fg</code> command
<li>Restarting a stopped command in the background with the <code>bg</code> command
</ul>

<p>
The csh paper also discusses how notifications are printed to the terminal when a command is stopped or exits, and how the shell maintains a table of numbered commands which can be used instead of processs IDs in certain commands.
These aren&rsquo;t strictly &ldquo;ways users can control running commands&rdquo;, but they are useful, so they might be considered optional to add in <i>es</i>.

<p>
Now, in csh, and traditionally in job controlling shells, a single command is a <em>job</em>, but in POSIX system calls, that term doesn&rsquo;t exist.
Instead, the term to use is a <em>process group</em>.
In fact, &ldquo;job control&rdquo; can be more accurately described as &ldquo;process group management&rdquo;.

<p>
In a typical shell session, the user starts a terminal process, and the terminal then spawns a shell process.
That might create a process tree like:

<figure>
<pre>
<samp>PID     COMMAND
1024    xterm
1025     \_ es</samp>
</pre>
</figure>

The terminal manages the &ldquo;pane of glass&rdquo; for user input and user-facing output; the shell reads commands and runs them, invoking other processes as necessary.
If a user enters a command like

<figure>
<pre>
<samp>; </samp><kbd>grep '~' .esrc | wc -l</kbd>
</pre>
</figure>

<p>
then while that command is running, the process tree would become

<figure>
<pre>
<samp>PID     COMMAND
1024    xterm
1025     \_ es
1213         \_ grep
1214         \_ wc</samp>
</pre>
</figure>

<p>
We can see that for this single command, the shell spawns two processes with different process IDs.

<p>
Now, suppose the user types control-C (<code>^C</code>) into the terminal while these are running.
When this happens, it&rsquo;s the terminal&rsquo;s job to send a <code>SIGINT</code> to stop what&rsquo;s running.
But which of the three processes (<code>es</code>, <code>grep</code>, and/or <code>wc</code>) should the terminal send that signal to?

<p>
In the non-job-control world, the signal must go to all of them.
It&rsquo;s up to the shell to ignore or handle a <code>SIGINT</code> while it&rsquo;s waiting for child processes to finish.
Similar questions have the same answer: Which processes can read from the terminal?
All of them&mdash;and if multiple try to read from the terminal at once, things can get messy.

<p>
For the sake of job control, two new OS-level concepts are introduced: the <em>session</em> and the <em>process group</em>.
Every process is part of a process group, and every process group is part of a session; a session can have more than one process group, and a process group can have more than one process.

<p>
A session is the set of all the processes associated with a terminal, called the &ldquo;controlling terminal&rdquo;.

<p>
A process group is the set of processes which can be in the foreground of that terminal at any one time.

<p>
So for our example command in a job-controlling shell, this would look something like:

<figure>
<pre>
<samp>SID    PGID    PID    COMMAND
1024   1024   1024    xterm
1025   1025   1025     \_ es
1025   1213   1213         \_ grep
1025   1213   1214         \_ wc</samp>
</pre>
</figure>

<p>
The session with ID 1025 has the running xterm as its controlling terminal, and contains the shell and both processes in the command.
The shell has its own process group, 1025, corresponding with its own PID; while the two processes from the command are running, they have their own process group ID.
This process group 1213 is the foreground process group in the terminal; the shell will be in the background until the command finishes or stops.

<p>
The foreground process group contains the set of processes the terminal interacts with.
In particular, signals generated due to characters like <code>^C</code> are sent to all the processes in the foreground, and foreground processes can read from the terminal, while background processes that try to do so are sent a <code>SIGTTIN</code> signal which (by default) stops them.

<p>
Speaking of stopping: Job control requires the shell to be aware not only of processes which have exited or been killed by a signal, but also those which are stopped&mdash;that is, paused by a specific signal such as <code>SIGTSTP</code>, <code>SIGTTIN</code>, or <code>SIGTTOU</code>.
These processes are not running but can be continued by sending them a <code>SIGCONT</code> signal.
Both the <code>fg</code> and <code>bg</code> commands in job control shells use this signal.

<p>
These are, in general, the OS-level mechanisms which back job control.
The GNU project have <a href="https://sourceware.org/glibc/manual/latest/html_node/Job-Control.html">a very usefully detailed guide on everything required to implement it</a>, which goes into basically every system call required (many of which <i>es</i> already performs in order to avoid cases where other processes misbehave and cause the terminal to exit!)
So, how should <i>es</i> expose these behaviors to users?


<h2>Extensible job control</h2>

<p>
The central requirement of job control is the ability to spawn child processes in their own process group.
It turns out that <i>es</i> already has a function which places processes in a new process group, called <code>newpgrp</code>.
This function takes no arguments and places the current <i>es</i> process into its own process group.
It was added to work around a bug in NeXTSTEP where terminals created every top-level shell in a single process group, presumably under the assumption that each shell would manage its own process group correctness.

<p>
I propose extending <code>newpgrp</code> so that, when given a command as its arguments, that command will be invoked such that every new process created in the process will be placed into a single, shared process group.
In the following example, both <code>cat</code> and <code>base64</code> would run in a child process group.

<figure>
<pre>
<samp>; </samp><kbd>newpgrp {grep '~' .esrc | wc -l}</kbd>
</pre>
</figure>

<p>
A couple notes about this <code>newpgrp</code>:

<ul>
<li>While every child process can run in a different process group from the shell itself, if the child processes don&rsquo;t run at the same time, they cannot run in the same process group.
In a command like <code>newpgrp {cat file1; cat file2}</code>, <code>newpgrp</code> would place each <code>cat</code> into a separate process group.

<li>
In cases where <code>newpgrp</code> calls nest, the outer call &ldquo;wins&rdquo;, such that every concurrent child process within the context of <em>any</em> <code>newpgrp</code> call will be placed into a common process group.
This is less intuitive than the alternative but works more naturally with how <code>newpgrp</code> is hooked into a job-control shell.

<li>
The scope of a <code>newpgrp</code> call is dynamic; <code>newpgrp my-func</code>, where <code>my-func</code> creates some child processes, would place those processes into a process group.
</ul>

<p>
Now we need a way to call <code>newpgrp</code> automatically in the right situations.
Most of the ways <i>es</i> has to spawn a subprocess, like <code>%pipe</code> and <code>%background</code>, already have hook functions, but the simplest and most common way, a simple foreground binary invocation like <code>ls</code>, does not.

<p>
To fix this, I propose taking the existing <code>%run</code> function and making it a hook function used by the shell to invoke other binaries.
This would add no new features to <i>es</i>, but like with <code>newpgrp</code>, it would take a function that is currently obscure and make it much more actively useful.
To my mind, using <code>%run</code> as a hook is the Right Thing, with or without job control motivating it.

<p>
With these two changes, it would take something like the following to start spawning child processes in their own process groups.

<figure class="centered bigfig">
<pre>
<code>let (r = $fn-%run)
fn %run {
	$fn-%make-job $r $*
}

let (p = $fn-%pipe)
fn %pipe {
	$fn-%make-job $p $*
}

let (b = $fn-%background)
fn %background {
	$fn-%make-job $b $*
}</code>
</pre>
<figcaption>Defining and hooking the <code>%make-job</code> function.</figcaption>
</figure>

<p>
In this snippet we use <code>%make-job</code> instead of calling <code>newpgrp</code> directly in order that process group creation can be toggled on and off as necessary.
This is immediately useful for the other functions which create subprocesses, which we have to hook like

<figure class="centered bigfig">
<pre>
<code>let (b = $fn-%backquote)
fn %backquote {
	local (fn-%make-job = ()) $b $*
}

let (r = $fn-%readfrom)
fn %readfrom f in cmd {
	$r $f {local (fn-%make-job = ()) $in} $cmd
}

let (w = $fn-%writeto)
fn %writeto f out cmd {
	$w $f {local (fn-%make-job = ()) $out} $cmd
}</code>
</pre>
<figcaption>Disabling job control for I/O-related functions.</figcaption>
</figure>

<p>
Now that process groups can be created, we need mechanisms to refer to them and to manage them.
<i>Es</i> already has a mechanism to refer to child processes, used by <code>%background</code> and consistent with conventions in the rest of the OS: the pid.
The natural extension of this convention for process group IDs is to refer to the pgid as a negative number.
This is used both within the POSIX specification for libc (see <code>wait(3p)</code>) and command-line utilities (see <code>kill(1p)</code>).
Using negative numbers for process groups is the most promising way to avoid needing to wrap a number of commands such as <code>kill</code> in functions whose purpose is just to convert from some version of a &ldquo;job name&rdquo; to one or more pids.

<p>
In order to facilitate getting the pgid for a particular process group, I propose a new hook function called <code>%reap</code>.
This function would be called by the shell&rsquo;s internal <code>wait()</code> logic any time a subprocess has stopped or exited.
The current behavior for <code>%reap</code> to imitate would be the internal <code>printstatus()</code> function, which prints a message to standard out when a process is killed by a signal; with job control, <code>%reap</code> can be extended to manage <code>$apid</code> in a more job-control-useful manner, and to print appropriate messages when processes are stopped.

<figure>
<pre>
<code>fn %reap pid did status {
	if {~ $did stopped} {
		apid = $pid
	} {~ $did signaled &amp;&amp; !~ $status (sigint sigpipe)} {
		echo &gt;[1=2] $pid^: $status
	}
}</code>
</pre>
</figure>

<p>
The parameters to <code>%reap</code> are: <code>pid</code>, representing the process ID (or process group ID) of the process which has exited; <code>did</code>, one of <code>signaled</code>, <code>exited</code>, or <code>stopped</code> (note the correspondence with the <code>WIF.*()</code> macros documented in <code>wait(3p)</code>); and <code>status</code>, which has either the exit status or signal of the process.

<p>
Broadly speaking, <code>%run</code> makes it possible to communicate &ldquo;down&rdquo; to the child process in new ways, and <code>%reap</code> makes it possible to communicate &ldquo;up&rdquo; to the parent shell.
This is a little unintuitive, but it&rsquo;s largely determined by the call site of the two functions: a <code>%run</code> call may be made in a subshell already created by <code>%pipe</code>, for example, where it can&rsquo;t modify the parent shell&rsquo;s state, but <code>%reap</code> is called from the parent shell before the information it exposes is needed for something like job control.

<p>
To be able to foreground, background, and continue process groups in <i>es</i>, I propose two new flags on the <code>$&amp;wait</code> primitive.
The first, <code>-n</code>, corresponds with the <code>WNOHANG</code> flag of the <code>waitpid()</code> function (see <code>wait(3p)</code>): if no process is ready to be reaped at the time <code>wait</code> is called, it will not hang and will instead return immediately.
The second flag, <code>-c</code>, causes <code>$&amp;wait</code> to foreground the process if necessary and send it a <code>SIGCONT</code> signal (it must be done in this order to avoid a race where the process gets itself stopped by reading from the terminal after the <code>SIGCONT</code> and before the foregrounding; this is why we build it into <code>$&amp;wait</code>).

<p>
With these two flags, basic versions of <code>fg</code> and <code>bg</code> can be implemented as

<figure>
<pre>
<code>fn-fg = $&amp;wait -c
fn-bg = $&amp;wait -nc</code>
</pre>
</figure>

<p>
(real versions of these two functions should be written to default to using <code>$apid</code> if no pid is given.)

<p>
One last, small addition would be new syntax for the <code>signals</code> variable, which would behave like the <code>/signame</code> syntax which ignores a signal only in the shell process but leaves its handling default in child processes, but applies that logic to the shell&rsquo;s process group instead.
I don&rsquo;t have a strong opinion about what symbol should be used, but <code>+signame</code> is the syntax I have used thus far.
This would allow the shell, and processes started within the shell&rsquo;s process group as with <code>%backquote</code> or <code>%readfrom</code> and <code>%writeto</code>, to be protected from job-control signals while other subprocesses are appropriately exposed to them.

<p>
So, these are all the components that I think are necessary to implement a job control shell.
The last component of note is a spoof of <code>%interactive-loop</code>, in order to ignore the necessary signals, define <code>%make-job</code>, and place the terminal in its own process group:

<figure>
<pre>
<code>let (loop = $fn-%interactive-loop)
fn %interactive-loop {
	signals = $signals +sigtstp +sigttin +sigttou
	local (
		fn-%make-job = newpgrp
		noexport = $noexport fn-%make-job
	) {
		newpgrp
		$loop $*
	}
}</code>
</pre>
</figure>

<p>
and there you have it.
Along with some invisible handling of the foreground terminal done automatically by the shell, this is everything required to manage process groups in <i>es</i>&mdash;the core feature set that job control needs.


<h2>Discussion</h2>

<p>
I believe that what is described here is a reasonable, roughly minimal set of features which make it possible to implement job control in <i>es</i>.
It is largely backwards-compatible, it works primarily by extending existing mechanisms (<code>newpgrp</code>, <code>%run</code>, <code>wait</code>, <code>$signals</code>) in backward-compatible ways, and for people who don&rsquo;t use job control, it ought to be occasionally useful and otherwise unobtrusive.
A <code>%run</code> hook can be used to customize how binaries are invoked, for debugging purposes or to imitate something like what bash or ksh sets <code>$_</code> to for child processes.
<code>wait -n</code> creates the ability to check for process completion without blocking, and <code>%reap</code> should enable a &ldquo;wait-any&rdquo; mechanism to be written.

<p>
A side-effect of the <code>%run</code> change is that it removes shell-specific behavior (the <code>fork</code>/<code>exec</code> call pair) from <i>es</i>&rsquo; core evaluation logic.
This helps generalize the shell; if <a href=/es/primitives.html>primitives are made customizable</a>, then it becomes (in theory) possible to swap out <code>$&amp;run</code> with, for example, an alternative using <code>posix_spawn</code>.
With some small adjustments to <i>es</i>&rsquo; evaluation logic (namely, using <code>%whatis</code> as a hook function), then the shell moves meaningfully closer to the &ldquo;librarified&rdquo; version that was once envisioned for it.

<p>
Of course, this isn&rsquo;t the only way that job control or process group management could be implemented.
There is a notable previous implementation by Olaf Rogalsky which exists in a branch in the <i>es</i> repository on Github.
In my mind, that version is faulty for a couple of reasons.
For one thing, it causes the shell to maintain a hard-coded table of jobs, necessitating translation functions for binaries such as <code>kill</code> and <code>renice</code>&mdash;something this version manages to sidestep by using <code>-pgid</code> identifiers instead.
Admittedly, this may be a benefit of implementing this feature much later, after operating systems have all standardized onto POSIX.
A more egregious fault of Olaf&rsquo;s version is the presence of the <code>$&amp;procchange</code> and <code>$&amp;procfree</code> primitives, which modify (and remove) internally-tracked information that should be managed wholly by the shell runtime.
I consider these two primitives similar to requiring a <code>$&amp;free</code> primitive to free up memory.

<p>
Hypothetical setups have been dreamt up in the past where the relevant process-management primitives (<code>$&amp;fork</code>, <code>$&amp;background</code>, <code>$&amp;wait</code>, <code>$&amp;pipe</code>, <code>$&amp;readfrom</code>, <code>$&amp;writeto</code>, etc.) are decomposed into smaller units of work, such that the existing hook functions could be defined something like, for example:

<figure>
<pre>
<code>fn %run bin argv {
	$&amp;wait &lt;={$&amp;fork {$&amp;exec $bin $argv}}
}

fn %background cmd {
	$&amp;fork {
		$&amp;newpgrp
		$cmd
	}
}</code>
</pre>
</figure>

<p>
This is an interesting direction, and, if done correctly, could be a useful generalization, requiring fewer distinct primitives to perform the same (or more) actions.

<p>
However, achieving job control with these &ldquo;smaller&rdquo; primitives would still require changes like making <code>%run</code> a hook function, adding the ability to create process groups from multiple processes and wait for the whole group as a unit, and performing non-blocking waits and (correctly) foregrounding/continuing processes.
Because of this, I believe that this kind of primitive-decomposition work is not an alternative to what is proposed here so much as it would be a future, additional area to investigate.

<p>
There are some limitations to what is proposed here; for example, there is no clear path to implement the <code>notify</code>/<code>NOTIFY</code> options in csh and zsh.
Presumably this could be performed using a <code>sigchld</code> exception handler, but I expect some novel mechanism of cooperation with the shell&rsquo;s input routines would be required.

<p>
An even larger limitation is the shell&rsquo;s inability to properly control internal and compound commands.
The promise of job control is that anything typed into the terminal should be controllable as a unit, but none of the following would be managed correctly with this proposed setup:

<figure>
<pre>
<samp>; </samp><kbd>while {true} {sleep 1}</kbd>
<samp>; </samp><kbd>touch foo; sleep 100; rm foo</kbd>
<samp>; </samp><kbd>x = `{date; sleep 100; date}</kbd>
</pre>
</figure>

<p>
The ideal behavior for these commands is that job control works just the same for them as it would if they were placed in a child process.
This isn&rsquo;t possible with <i>es</i> as it is today; it would require some way to save the continuation of a command, and to restart an internal command in the background (which, to be most correct, would require threading such that a backgrounded command could change a variable&rsquo;s value).

<p>
However, in addition to being difficult to implement, I believe this isn&rsquo;t particularly necessary for practical use.
As far as I am aware, no other shells handle these cases correctly:

<p>
<blockquote>
Compound commands and command lists of the form &ldquo;a ; b ; c&rdquo; are not handled gracefully when combined with process suspension.
When a process is stopped, the shell immediately executes the next command in the list or breaks out of any existing loops.
</blockquote>
<p>&mdash; Bash 5.3 man page BUGS section

<p>
<blockquote>
Shell builtin functions are not stoppable/restartable.
Command sequences of the form
<pre>
<code>a ; b ; c</code>
</pre>
are also not handled gracefully when stopping is attempted.
If you suspend &lsquo;b&rsquo;, the shell will then immediately execute &lsquo;c&rsquo;.
</blockquote>
<p>
&mdash; tcsh 6.24.16 man page BUGS section

<p>
Moreover, I believe that even if <i>es</i> were to gain the kind of continuation and threading mechanisms required to do this, they would still need to be integrated with the OS&rsquo; existing conventions for pausing and restarting work, which leads me to suspect it would not obviate this page&rsquo;s proposed process group management mechanisms, but instead extend them.

<p>
Maybe someday I will be able to write a page about advancing the state of the art of job control with <i>es</i>, using mechanisms for delimited first-class continuations, threading, and smaller, simpler primitives to do it.
Until then, I think adding these described mechanisms does a sufficient job giving users the utility they expect with minimal changes.


</main>
