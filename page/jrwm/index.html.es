<; cat tmpl/header.html >

<title>jpco.io | Hacking up a window manager is finally fun again</title>
<meta name=description content="A page talking about writing JrWM, a window manager based on the river wayland compositor">

<; build-nav >

<main>
<h1>Hacking up a window manager is finally fun again</h1>
<div class=time><time datetime=2026-06-13>2026-06-13</time></div>

<figure class=hero>
<; cat static/svg/windows.svg >
</figure>

<p>
I&rsquo;ve long been a fan of Wayland.
For anyone who doesn&rsquo;t know, Wayland is the major &ldquo;sequel&rdquo; system to the X Window System, which has been a core part of the experience of using a Unix operating system for decades.
Wayland is designed more directly for modern computing, supporting things like (without extensions, and without difficulty on the user&rsquo;s part) complex multi-monitor setups with mixed display resolutions, VSync, and more.

<p>
Being this kind of sequel makes Wayland somewhat like systemd, which, similarly, replaces a venerable Unix system with something which, for users, is faster and better suited to modern machines.

<p>
Unlike systemd, though, Wayland isn&rsquo;t a meaningful compromise in simplicity or comprehensibility.
Looking at basically any Unix-oriented mailing list, it isn&rsquo;t hard to find someone complaining about X being big and slow in just about any year in the last few decades.

<p>
As I see it, the major downside of Wayland comes due to its monolithic architecture: unlike in the X world, where the X server handles most of the complex pixel-pushing and a window manager merely needs to interact with it, a Wayland compositor needs to implement everything that the window manager would have done, in <em>addition</em> to everything the X server would have done as well.
This has inhibited the number of Wayland window managers that have been written, because writing an entire compositor just to explore a unique take on window management is simply too big of a lift.

<p>
A couple different attempts have been made to bridge that gap.  Most notable is <a href="https://gitlab.freedesktop.org/wlroots/wlroots/">the wlroots library</a>, which was split from the Sway compositor and is, as it describes itself, &ldquo;about 60,000 lines of code you were going to write anyway.&rdquo;
The folks at the &ldquo;minimalist Wayland interest group&rdquo; <a href="https://wayland.fyi/">wayland.fyi</a> offer an alternative, more minimal set of libraries and compositors, choosing to eschew many of the features that other compositors have to struggle to maintain.  (Incidentally, having tried a few of these, they seem not to work very well on my machine.  Sometimes minimalism imposes costs of its own.)

<p>
Just a couple months ago, another kind of attempt has been made, by the River compositor.


<h2>The River Wayland compositor</h2>

<p>
<a href="https://isaacfreund.com/software/river/">River is a Wayland compositor</a> which is distinguished by being &ldquo;non-monolithic&rdquo;.
Written by Isaac Freund, River performs most of the work of a Wayland compositor (being built itself on wlroots), but exposes its own set of private Wayland protocols with which another program can interact in order to perform window management.
This enables, to some degree, the best of both worlds: A Wayland compositor, with all the modern niceties that Wayland provides, but with a similar sort of modularity that X made possible.

<p>
This is actually a relatively late-breaking change made to River.
Before version 0.4, River performed its own window management, with configuration and control happening via IPC from the external <code>riverctl</code> program shipped with the compositor.
I myself used this prior form of River for years, initially having picked it out because it shared some characteristics with my long-time preferred X window manager, <a href="https://github.com/baskerville/bspwm">bspwm</a>.
I didn&rsquo;t look at this new version of River until the <code>river</code> package on my machine was renamed to <code>river-classic</code>, and I got curious enough to start looking at the &ldquo;new hotness&rdquo;.

<p>
At the time of writing, there are <a href="https://codeberg.org/river/wiki/src/branch/main/pages/wm-list.md">several window managers for River</a> that have already been written, and I was hoping that I could adopt this newly non-monolithic paradigm with one of them.
None of them were quite satisfying, though.

<p>
For one thing, none of these WMs have been around long enough or picked up enough usage to have been packaged in the official Arch repos, and so to use any of them, I&rsquo;d have to build it myself&mdash;and most of the window managers that have been written are in languages I don&rsquo;t already use.
For the most part, outside of work, I spend my time hacking in C, and my degree of patience for installing an entire new language toolchain for each window manager I want to explore is not very high at all.

<p>
So, given that, I was hoping to find a simple tiling window manager written in C that I could quickly build and explore.
At the time of writing, here were two tiling WMs implemented in C listed on the River wiki: <a href="https://sr.ht/~zuki/zrwm/">zrwm</a> and <a href="https://codeberg.org/auoggi/anvl">anvl</a>.
Neither of these worked great for me, though:

<ul>
<li>
Both of them have weirdnesses with building.
Zrwm uses something called <a href="https://github.com/tsoding/nob.h">nob</a>, a custom, experimental build system entirely using C.
It does seem like a neat idea to be able to say &ldquo;my C compiler and code is my only build dependency&rdquo;, but in practice it feels a little like bragging that you&rsquo;re saving on your heating bills by burning trash in your living room.

<li>
Meanwhile, anvl doesn&rsquo;t build on my machine at all.
In part, this is because it uses the <code>fd</code> utility, some alternative to <code>find(1)</code>, and I don&rsquo;t use or want to use that.

<li>
Neither of them correctly manage spawned child processes.
This would be easy to fix, fortunately (as I describe below).

<li>
Finally, and this is purely aesthetic, but both projects have code that is, to me, pretty ugly and hard to actually read and work with.
I think both codebases seem to be based on that of the dwm window manager for X, possibly by way of the dwl standalone Wayland compositor, but some things have been made more crufty in the one or two steps of adaptation, and the codebases are kind of hard to follow.

</ul>

<p>
So, I decided to take the opportunity to just try writing my own window manager, and hopefully solve some of my historic window-manager pet peeves along the way.
What came out of this effort is <a href="https://github.com/jpco/jrwm">JrWM</a>.


<h2>JrWM</h2>

<p>
JrWM (short for &ldquo;Junior Window Manager&rdquo;, or &ldquo;Jpco&rsquo;s river Window Manager&rdquo;) is in spirit similar to the other C tiling window managers for River, but written to satisfy my own practical and aesthetic goals.

<p>
As described in its README, JrWM is designed to be small, low-dependency, easy to build, read and modify, and to have a good degree of correctness.
It is built with a fairly simple Makefile portable to (at least) both GNU and BSD <code>make</code>, and comprises a single header file <code>jrwm.h</code> with three C files: <code>jrwm.c</code>, <code>bindings.c</code>, and <code>layout.c</code>.

<p>
This is an immediate departure from the other C window managers, including <a href="https://codeberg.org/river/tinyrwm">the tinyrwm window manager</a> provided as a &ldquo;demo&rdquo; as part of the River project, which all pack all of their window management code into a single file.
I find that the organization of JrWM allows each file to be better focused, and therefore more legible: <code>jrwm.c</code> handles listening for Wayland events and dispatching to other files, <code>bindings.c</code> handles managing and dispatching key bindings, and <code>layout.c</code> handles the placement and focus of the entities in the window manager.

<p>
JrWM is not especially novel with its behavior nor rich with its feature set.  Each window is organized into a &ldquo;space&rdquo;, and an output can switch between spaces to view different sets of windows.
Each space has its own layout, though there are just two layouts at the moment: a dwm-style tiling layout, and a monocle layout.
Spaces have a secondary role in the WM as a sort of &ldquo;clearing house&rdquo; type: each of the major components of the WM (the windows, outputs, and seats) all point to a space, and it is only via spaces that these components can refer to each other.
This simplifies the management of all these objects as they are dynamically added to and removed from a running session.

<p>
The more carefully thought-out code layout and the simplification provided by using spaces together make it easier to achieve JrWM&rsquo;s last listed design goal, which is thorough correctness.

<p>
The first form of correctness JrWM does pretty well is its behavior with the River window management protocol.
Within this protocol, code can be running during one of three phases: the manage sequence, the render sequence, and everything in between.
<a href="https://isaacfreund.com/blog/river-window-management/">The relevant River blog post</a> explains what these two sequences are in detail, but the upshot is that certain behaviors can only be performed during one of the two sequences; attempting these behaviors at other times is a protocol error.
River seems to be forgiving with out-of-sequence calls, but trying to get this right (and making it easy to do so, by making it clear during which sequence, if either, functions run) is still a goal of JrWM, and I <em>believe</em> this is achieved pretty well.

<p>
In fact, JrWM is over-conservative: according to the documentation for the <code>river-window-management-v1</code> interface,

<blockquote>
[r]endering state may be modified by the window manager during a manage
sequence or a render sequence.
</blockquote>

<p>
But at the same time, the documentation for the protocol also states, for each request which modifies rendering state,

<blockquote>
This request [...] may only be made as part of a render sequence, see the river_window_manager_v1 description.
</blockquote>

<p>
I believe this more restrictive statement is incorrect, but in the face of doubt, JrWM is more conservative and only changes rendering state during render sequences.

<p>
The other form of correctness JrWM targets is that of the environment of its spawned subprocesses.
Like a shell, a window manager typically spawns child processes in order to start up graphical applications, and these child processes need to be reaped after they exit.
A window manager could manually wait for and reap child processes like a shell does, with <code>wait(3)</code> or <code>waitpid(3)</code>, but given window managers tend not to be nearly as fastidious with exit statuses as a shell is, the easiest thing to do is to simply call <code>signal(SIGCHLD, SIG_IGN)</code> (or the equivalent with <code>sigaction(3)</code>); if a process ignores <code>SIGCHLD</code>, then child processes will be automatically reaped after they exit.

<p>
However, ignoring <code>SIGCHLD</code> creates its own obligation to then <em>un</em>-ignore <code>SIGCHLD</code> when forking off a child process, so that that process has a normal operating environment to run in.
Many programs, like shells, will automatically un-ignore <code>SIGCHLD</code> themselves on startup, but it is (at the very least) bad hygiene to require every child process to do this.

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
And, looking at its source as of the time of writing, dwm does exactly this (though using the preferable <code>sigaction(3)</code> call, rather than <code>signal(3)</code>):

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
Because my desktop computing setup <a href=/es/desktop.html>could be reasonably described as barbaric</a> (a single monitor on a laptop with no lock screen; window decorations only to show focus; no wallpaper, window margins, or animations; a computing environment that&rsquo;s 99% terminal and browser; and a plain status bar that only displays battery state, a clock, and <a href=/notcat>notifications</a>), I don&rsquo;t have a good intuition for things like how multi-output setups are expected to work, so while there is technically <em>a</em> workable behavior implemented, it may not be something anybody considers familiar or correct.
I would love if someone could tidy these behaviors for me.
I&rsquo;ll probably get to it myself at some point, assuming nobody else does.

<p>
I am, at the moment, dissatisfied with JrWM&rsquo;s multi-seat handling.  This is in part due to the &ldquo;space&rdquo; simplification: the WM can&rsquo;t actually model multiple windows having focus within a single space.
Assuming this is fixed, though, there is still the more severe problem that the window manager has no way to know with which seat a newly-created window should be associated.
I believe this requires River integrating with the <code>xdg-activation-v1</code> protocol to get right, but I don&rsquo;t know what workarounds are available.
Given this isn&rsquo;t just a missing feature, but an incorrect behavior, it&rsquo;s a real pet peeve.
(One of my goals was to avoid global state as much as possible, in part to be flexible around multiple Outputs and Seats.)

<p>
Lastly, I would like to get floating windows into the shell at some point fairly soon, at the very least for dialog-type windows.

<p>
One last thing to note is that I&rsquo;m really not actually very knowledgeable about the nitty gritty of Wayland.
While I&rsquo;m a reasonably experienced C hacker (and a professional code critic), the whole ecosystem that exists around Wayland and its many protocol extensions remains fairly obscure to me, which means that I&rsuqo;m probably wrong about details around both correctness and features and I don&rsquo;t even know it!


<h2>Conclusion</h2>

<p>
I&rsquo;m really pretty excited about River as a project and the small (but quickly growing) community of window managers that are springing up around it.
Writing up JrWM has been fairly quick and enjoyable, with little unnecessary cruft getting in the way of the meaty stuff.
While it&rsquo;s not the most thrilling or novel piece of software, I hope JrWM is at least slightly as useful for others as it is for me.


</main>
