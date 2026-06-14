<; cat tmpl/header.html >

<title>jpco.io | Hacking up a window manager is finally fun again</title>
<meta name=description content="A page talking about writing JrWM, a window manager based on the river wayland compositor">

<; build-nav >

<main>
<h1>Hacking up a window manager is finally fun again</h1>
<div class=time><time datetime=2026-06-11>2026-06-11</time></div>

<figure class=hero>
<; cat static/svg/windows.svg >
</figure>

<p>
I&rsquo;ve long been a fan of Wayland.
Similarly to systemd, Wayland is a &ldquo;sequel&rdquo; system to a longstanding core part of Unix which offers a faster, more secure mechanism better suited to today&rsquo;s computers and people.
Unlike systemd, though, Wayland isn&rsquo;t a meaningful compromise in simplicity or comprehensibility.
Looking at basically any Unix-oriented mailing list, it isn&rsquo;t hard to find someone complaining about X being big and slow in just about any year in the last few decades.

<p>
The one major downside of Wayland, though, comes due to its single-process architecture: unlike in the X world, where the X Server handles most of the complex stuff and a window manager can be written to interact with it fairly easily, Wayland generally requires a compositor to be one big project.
This has inhibited the number of Wayland window managers that have been written, because writing an entire compositor just to get a unique take on window management is just too big of a lift.

<p>
<a href="https://gitlab.freedesktop.org/wlroots/wlroots/">The wlroots library</a> was split from the Sway compositor to help bridge this gap: as it describes itself, wlroots is &ldquo;about 60,000 lines of code you were going to write anyway.&rdquo;
The folks at the &ldquo;minimalist Wayland interest group&rdquo; <a href="https://wayland.fyi/">wayland.fyi</a> offer an alternative, more minimal set of libraries and compositors, choosing to eschew many of the features that other compositors struggle to maintain.  (Incidentally, having tried a few of these, they seem not to work very well on my machine.  Sometimes minimalism has its own costs.)

<p>
Relatively recently, another kind of attempt has been made by River.


<h2>The River Wayland compositor</h2>

<p>
<a href="https://isaacfreund.com/software/river/">River is a Wayland compositor</a> which is distinguished by being &ldquo;non-monolithic&rdquo;.
It performs most of the work of a Wayland compositor (itself being built on wlroots), but exposes its own set of Wayland protocols on which another program can perform window management.
To a rough approximation, this allows Wayland to use the X model of a &ldquo;display server&rdquo; with a separate window manager.

<p>
This is actually a relatively recent change made to River; prior to version 0.4, River performed its own window management, with configuration performed via IPC from the external <code>riverctl</code> program.
I myself used River for years in its prior form, initially having selected it because it shared some characteristics with my long-time preferred X window manager, <a href="https://github.com/baskerville/bspwm">bspwm</a>.
It wasn&rsquo;t until Arch updates moved me from the <code>river</code> package to <code>river-classic</code> that I started looking into the new set of options that were available.

<p>
At the time of writing, there are <a href="https://codeberg.org/river/wiki/src/branch/main/pages/wm-list.md">several window managers for River</a> that have already been written, and I was hoping that I could adopt this newly non-monolithic paradigm with one of them.
None of them were quite satisfying, though.
For one thing, none of these have been around long enough or picked up enough usage to have been packaged in the official Arch repos, and so I&rsquo;d have to build one myself&mdash;and the big constraint there is that most of the window managers that have been written are in languages I&rsquo;d rather not use.
While one benefit of River&rsquo;s new non-monolithic setup is that it opens up the set of languages window managers can be written in, I don&rsquo;t have most of these language toolchains on my laptop; I have C.

<p>
I just wanted a simple tiling window manager written in C that I could build and be on my way.
There are two such WMs listed on the River wiki: <a href="https://sr.ht/~zuki/zrwm/">zrwm</a> and <a href="https://codeberg.org/auoggi/anvl">anvl</a>.
Both of these are a bit unsatisfactory to me, though:

<ul>
<li>
Both of them have weirdnesses with building.
Zrwm uses <a href="https://github.com/tsoding/nob.h">nob</a>, a custom, experimental build system entirely using C.
It does seem like a neat idea to be able to say &ldquo;my C compiler and code is my only build dependency&rdquo;, but in practice it feels a little like bragging that you&rsquo;re saving on your heating bills by burning trash in your living room.

<li>
Meanwhile, anvl doesn&rsquo;t build on my machine at all.
I suppose I could try to debug this.

<li>
Neither of them correctly manage spawned child processes. This is easy to fix, fortunately.

<li>
Finally, and this is purely aesthetic, but both projects have code that is, to me, pretty ugly and hard to actually read and work with.
I acknowledge this is an issue with me, but if I find a codebase ugly it very much demotivates me from wading in to try to improve the behavior of the built program.

</ul>

<p>
So I decided to take the opportunity to just try writing my own.
What came out of this effort is <a href="https://github.com/jpco/jrwm">the JrWM window manager</a>.


<h2>JrWM</h2>

<p>
JrWM (short for &ldquo;Junior Window Manager&rdquo;, or &ldquo;Jpco&rsquo;s river Window Manager&rdquo;) is in spirit similar to the other C tiling window managers for River, but written to satisfy my own practical and aesthetic goals.

<p>
As described in its README, JrWM is designed to be small, low-dependency, easy to build, read and modify, and to have a good degree of correctness.
It is built with a fairly simple Makefile portable to (at least) both GNU and BSD <code>make</code>, and comprises a single header file <code>jrwm.h</code> with three C files: <code>jrwm.c</code>, <code>bindings.c</code>, and <code>layout.c</code>.

<p>
This is an immediate departure from the other C window managers, including <a href="https://codeberg.org/river/tinyrwm">the tinyrwm window manager</a> provided as a &ldquo;demo&rdquo; as part of the River project, which all pack all of their window management code into a single file.
I find that the organization of JrWM allows each file to be better focused: <code>jrwm.c</code> handles listening for Wayland events and dispatching to other files, <code>bindings.c</code> handles managing and dispatching key bindings, and <code>layout.c</code> handles the placement and focus of the entities in the window manager.

<p>
JrWM is not especially novel with its behavior nor rich with its feature set.  Each window is organized into a &ldquo;space&rdquo;, and an output can switch between spaces to view different sets of windows.
Each space has its own layout, though there are just two layouts at the moment: a dwm-style tiling layout, and a monocle layout.
Spaces have a secondary role in the WM as a sort of &ldquo;clearing-house&rdquo; type: each of the major components of the WM (the Windows, Outputs, and Seats) all point to a space, and it is via spaces that these components can refer to each other.
This simplifies the management of these objects as they are dynamically added to and removed from a running session.

<p>
The more carefully thought-out code layout and the simplification provided by using spaces together make it easier to achieve JrWM&rsquo;s last listed design goal, which is thorough correctness.

<p>
The first form of correctness JrWM does pretty well is its behavior with the River window management protocol.
Within this protocol, code can be running during one of three phases: the manage sequence, the render sequence, and everything in between.
<a href="https://isaacfreund.com/blog/river-window-management/">The relevant River blog post</a> can explain what these two sequences are in detail, but the upshot is that certain behaviors can only be performed during one of the two sequences; doing these things at other times is a protocol error.
Fortunately, River seems to be forgiving with out-of-sequence calls, but trying to get this right (and making it easy to do so, by making it clear during which sequence, if either, functions run) is still a goal of JrWM, and I <em>believe</em> this is achieved.
In fact, JrWM is overconservative: according to the <code>river-window-management-v1</code> documentation,

<blockquote>
[r]endering state may be modified by the window manager during a manage
sequence or a render sequence.
</blockquote>

<p>
Actually, there is a bit of ambiguity in the documentation.
While the previous quote states that rendering state may be changed during a manage sequence in general, each specific call that modifies rendering state has a sentence which reads:

<blockquote>
This request modifies rendering state and may only be made as part of a
render sequence, see the river_window_manager_v1 description.
</blockquote>

<p>
I believe this more restrictive statement is incorrect, but in the face of doubt, JrWM is more conservative and only changes rendering state during render sequences.

<p>
The other form of correctness JrWM targets is that of the environment of its spawned subprocesses.
Like a shell, a window manager spawns child processes in order to start up graphical applications.
These child processes need to be reaped.
A window manager could reap child processes like a shell does, with <code>wait(3)</code> or <code>waitpid(3)</code>, but most programs are not nearly as fastidious with exit statuses as a shell is.
If this is the case, the easiest thing to do is to simply call <code>signal(SIGCHLD, SIG_IGN)</code> (or the equivalent with <code>sigaction(3)</code>); if a process ignores <code>SIGCHLD</code>, then child processes will be automatically reaped after they exit.

<p>
However, this creates an obligation to then <em>un</em>-ignore <code>SIGCHLD</code> when forking a child process.
Many programs, like shells, will automatically un-ignore <code>SIGCHLD</code> themselves on startup, but it is bad hygiene to require every child process to do this themselves.

<p>
In addition, a window manager must <code>setsid(3)</code> each child process it creates to ensure that each new window is part of a distinct session.
This is simply part of the process hierarchy protocol of POSIX-compatible Unix operating systems.

<p>
Putting these together, the most minimal but still correct way to spawn a child process (assuming the window manager configured itself with <code>signal(SIGCHLD, SIG_IGN)</code> at startup) is:

<figure>
<pre>
<code>if (fork() == 0) {
	signal(SIGCHLD, SIG_DFL);
	setsid();
	exec(...);
}</code>
</pre>
</figure>

<p>
And dwm does exactly this (though using the preferable <code>sigaction(3)</code> call, rather than <code>signal(3)</code>):

<figure>
<pre>
<code>if (fork() == 0) {
	if (dpy)
		close(ConnectionNumber(dpy));
	setsid();

	sigemptyset(&amp;sa.sa_mask);
	sa.sa_flags = 0;
	sa.sa_handler = SIG_DFL;
	sigaction(SIGCHLD, &amp;sa, NULL);

	execvp(((char **)arg-&gt;v)[0], (char **)arg-&gt;v);
	die("dwm: execvp '%s' failed:", ((char **)arg-&gt;v)[0]);
}</code>
</pre>
</figure>


<h2>Caveats</h2>

<p>
Ironically, JrWM&rsquo;s greatest weakness is probably its actual UX.
Because my desktop computing setup could be reasonably described as &ldquo;rudimentary&rdquo; (no lock screen, single monitor on a laptop, a computing environment that&rsquo;s 99% terminal, browser, and a bar that only displays battery state, a clock, and <a href=/notcat>notifications</a>), I don&rsquo;t have a good intuition for things like how multi-output setups are expected to work, so while there is technically a workable behavior implemented, it may not be something anybody considers familiar or correct.
I would love if someone could tidy these behaviors for me&mdash;I&rsquo;ll probably get to it myself at some point, assuming nobody else does.

<p>
I am, at the moment, dissatisfied with JrWM&rsquo;s multi-seat handling.  This is in part due to the &ldquo;space&rdquo; simplification: the WM can&rsquo;t actually model multiple windows having focus within a single space.
Assuming this is fixed, though, there is still the more severe problem that the window manager has no way to know with which seat a newly-created window should be associated.
I believe this requires River integrating with the <code>xdg-activation-v1</code> protocol to get right, but I don&rsquo;t know what workarounds are available.
Given this isn&rsquo;t just a missing feature, but an incorrect behavior, it&rsquo;s a real pet peeve.
(One of my goals was to avoid global state as much as possible, in part to be flexible around multiple Outputs and Seats.)

<p>
Lastly, I would like to get floating windows into the shell at some point fairly soon, at the very least for dialog-type windows.
Given I have very little use for these myself, my level of motivation to add them in is low.


</main>
