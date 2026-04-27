<; cat tmpl/header.html >

<title>jpco.io | Quirks of the es interpreter</title>
<meta name=description content="Documentation of some of the quirks of the es interpreter codebase.  These quirks are a result of the age of the codebase as well as its behavior.">

<; build-nav >

<main>
<h1>Quirks of the <i>es</i> interpreter</h1>
<div class=time><time datetime="2026-01-03">2026-01-03</time></div>

<p>
Despite the fact the <i>es</i> interpreter runtime is written in ANSI C and should build and run with just about any reasonably standards-compliant compiler and OS, it is an odd-looking codebase, containing a number of less-common patterns and mechanisms.

<p>
A certain type of person will be excited to read that most of these mechanisms involve &ldquo;advanced&rdquo; use of preprocessor macros.
A different type of person, upon reading that, will have an urge to close this page immediately.

<p>
Understanding some of these aspects of <i>es</i> can take some time without any documentation available, so this page is intended to help.

<h2 id=gc>The garbage collector</h2>

<p>
<i>Es</i> uses a bespoke <a href=/es/paper.html#garbage-collection>copying garbage collector</a>, and precisely and explicitly tracks variable references in order that the GC knows what can and cannot be collected at any time.
This reference tracking is one of the most conspicuous oddities visible throughout <i>es</i> code.

<figure>
<pre>
<code>Ref(List *, lp, list);
sethistory(getstr(lp-&gt;term));
RefReturn(lp);</code>
</pre>
</figure>

<p>
In the above example, these <code>Ref</code> and <code>RefReturn</code> macros define blocks of code where the variable <code>lp</code> is known by the garbage collector and kept up-to-date across collections.
The macros are expanded to rewrite the above block into the something like the following.

<figure>
<pre>
<code>{
	List *lp = list;
	add_root(lp);
	sethistory(getstr(lp-&gt;term));
	remove_root(lp);
	return lp;
}</code></pre>
</figure>

<p>
Laying it out in prose, the behavior here is

<ol>
<li><p><code>Ref(List *, lp, list)</code>:
	<ol>
	<li>introduces a new block,
	<li>declares a new <code>List&nbsp;*</code> called <code>lp</code>, which is assigned the value of <code>list</code>, and
	<li>adds <code>lp</code> to the GC&rsquo;s root list, ensuring <code>lp</code> remains valid across collections.
	</ol>
<li><p><code>sethistory(getstr(lp-&gt;term))</code> converts the first term of <code>lp</code> to a string &mdash; an action which may trigger a garbage collection &mdash; and calls <code>sethistory</code> on that string.
<li><p><code>RefReturn(lp)</code>:
	<ol>
	<li>removes <code>lp</code> from the root list,
	<li>returns <code>lp</code>, and
	<li>ends the block.
	</ol>
</ol>

<p>
Note that these macros, and similar ones like <code>RefEnd</code>, which has the same behavior as <code>RefReturn</code> except it does not return, involve beginning and ending blocks implicitly as part of the macro definition.
This has the benefit of making it more difficult to accidentally leak GC roots.
Unfortunately, the compiler errors produced due to missing <code>Ref</code>s or <code>RefEnd</code>s have very little to do with the semantics of the macros themselves, which can be confusing.

<p>
There are a couple challenges with working with GCed objects in <i>es</i>: not everything in <i>es</i> is garbage collected, and collections can&rsquo;t occur at just any moment.
This can make it somewhat difficult to predict exactly when a <code>Ref</code> needs to be used.
A good rule of thumb for collections is that they can occur any time the shell needs more memory, which can happen in one of two cases: allocations, and when the GC is enabled with a call to <code>gcenable()</code>.
A GC in the latter case is typically rare, but if enough allocations happen while the GC is disabled then it is possible for the shell to need to perform a collection immediately.

<p>
The trickiest case of this is when a collection may happen &ldquo;in the middle&rdquo; of a statement.
A simple, real example (fixed in <a href="https://github.com/wryun/es-shell/pull/52">one of my first contributions to the shell</a>) is the following, where <code>lr</code> is a <code>Ref</code>&rsquo;d pointer:

<figure>
<pre>
<code>lr-&gt;term = mkstr(str);</code>
</pre>
</figure>

<p>
The bug here is fairly subtle, and requires some understanding of C semantics as well as <i>es</i> memory management to explain.
The problem is that <code>lr-&gt;term</code> may evaluate to a particular memory location <em>before</em> <code>mkstr(str)</code> is called, and <code>mkstr()</code> may trigger a GC, which moves <code>lr</code> and <code>lr-&gt;term</code>.
If these both happen, then the result of the <code>mkstr()</code> will be stored in the pre-GC, now invalid, memory location.
Fixing cases like this requires splitting the statement up:

<figure>
<pre>
<code>Term *tmp = mkstr(str);
lr-&gt;term = tmp;</code>
</pre>
</figure>

<p>
Knowing exactly which objects are GCed and which aren&rsquo;t can sometimes be even harder to do than tracking when collections can happen, because it may be impossible to determine by the local code.
Generally, <code>List&nbsp;*</code>s, <code>Term&nbsp;*</code>s, and <code>Tree&nbsp;*</code>s are nearly always in the GCed space in memory.
<code>char&nbsp;*</code>s can go either way, and in some cases very similar functions can produce either a GC-space or standard malloc-space string.
For example, the <code>str()</code> and <code>mprint()</code> functions both function similarly to <code>sprintf(3)</code>, and only differ from each other in that <code>str()</code> produces a garbage collected string, while <code>mprint()</code> produces a string that needs to be <code>free()</code>-ed.

<p>
The most foolproof way to build confidence in GC behavior is to build with <code>GCDEBUG</code> enabled, as in the following test invocation.
The <code>GCDEBUG</code> define enables both <code>GCALWAYS</code>, which forces a GC pass to happen any time it is possible, and <code>GCPROTECT</code>, which disables collected areas of memory using <code>mprotect(3)</code>, causing references to stale pointers to trigger immediate crashes.
With both of these enabled, it is reasonably easy to know if a necessary <code>Ref</code> has been missed.

<figure class=centered>
<pre>
<code>; make ADDCFLAGS=-DGCDEBUG=1 clean test</code>
</pre>
<figcaption>Triggering segfaults the easy way.</figcaption>
</figure>


<h2 id=exceptions>The exception mechanism</h2>

<p>
<i>Es</i> has an exception mechanism, which, like the garbage collection mechanism, is implemented using macros which add a sort of exception mechanism to the C runtime itself.
These macros look like this, from the <code>runesrc()</code> function used to run the <code>.esrc</code> script:

<figure>
<pre>
<code>ExceptionHandler

	runfd(fd, esrc, 0);

CatchException (e)

	if (termeq(e-&gt;term, "exit"))
		exit(exitstatus(e-&gt;next));
	else if (termeq(e-&gt;term, "error")) {
		eprint("%L\n",
		       e-&gt;next == NULL ? NULL : e-&gt;next-&gt;next,
		       " ");
		return;
	}
	if (!issilentsignal(e))
		eprint("uncaught exception: %L\n", e, " ");
	return;

EndExceptionHandler</code>
</pre>
</figure>

<p>
The exceptions that the <code>CatchException</code> macro handles are <code>List&nbsp;*</code>s.
These are produced by calls to <code>throw()</code>, which is often itself called by the <code>fail()</code> function typically used to generate <code>error</code> exceptions.
The definition of the <code>$&amp;throw</code> primitive makes use of both of these exception-generating functions:

<figure>
<pre>
<code>if (list == NULL)
	fail("$&amp;throw", "usage: throw exception [args ...]");
throw(list);</code>
</pre>
</figure>

<p>
Under the hood, the <code>ExceptionHandler</code> macros manage a dynamic stack of <code>setjmp(3)</code> targets, and the <code>throw()</code> function pops the top target of the stack and performs a <code>longjmp(3)</code> to it; there is also some bookkeeping so that these exceptions &ldquo;just work&rdquo; in the face of GCed memory and dynamic variables.
However, exiting an <code>ExceptionHandler</code> block early with a <code>return</code> or <code>goto</code> will probably cause problems in later code, as the necessary exception handler cleanup couldn&rsquo;t happen (note that exiting a handler early with a <code>throw()</code> should be fine, because the <code>throw()</code> function performs its own cleaning-up behavior).

<p>
This setup is an <i>es</i>-specific implementation of a reasonably well-established set of conventions to add exceptions to C code.
<a href="https://www.cs.tufts.edu/~nr/cs257/archive/eric-roberts/exceptions.pdf">This paper by Eric S. Roberts</a> shows a version of this very similar to <i>es</i>&rsquo;, but <a href="https://archive.org/details/1985-proceedings-summer-portland/page/24/">early versions of exceptions in C</a> date back to as early as 1985.

<h2 id=signals>Signals</h2>

<p>
One of <i>es</i>&rsquo; jobs as a shell is to handle a steady stream of signals coming from the terminal, child processes, users, and elsewhere.
<i>Es</i> models signals in-language as exceptions, such that any signal that isn&rsquo;t ignored leads to a call to the <code>throw()</code> function discussed above.
This exception-generation behavior has to be done explicitly, so signal-specific breadcrumbs are present in the code base, primarily in the form of the <code>SIGCHK()</code> macro.

<p>
<code>SIGCHK()</code>, which simply wraps the <code>sigchk()</code> function, checks if any signals have been received by the shell and handles those signals however the user has configured it to&mdash;either ignoring it or converting it into a <code>signal</code> exception which it throws.

<p>
This follows the best practices of signal handling in C, where the signal handler itself does essentially nothing except increment a counter, which later code must check and handle more thoroughly.
The obvious follow-up question is, when should <code>SIGCHK()</code> be invoked?
That is a good question, and I don&rsquo;t have an answer to it.

<p>
The signal handler in <i>es</i> does one more thing, in addition to setting things up for <code>SIGCHK()</code>.
Right at the end of the handler is the following statement:

<figure>
<pre>
<code>if (slow)
	longjmp(slowlabel, 1);</code>
</pre>
</figure>

<p>
These variables, <code>slow</code> and <code>slowlabel</code>, are also referenced where <i>es</i> calls the readline library:

<figure>
<pre>
<code>if (!setjmp(slowlabel)) {
	slow = TRUE;
	r = readline(prompt);
} else {
	r = NULL;
	errno = EINTR;
}
slow = FALSE;
SIGCHK();</code>
</pre>
</figure>

<p>
This nine-line snippet is essentially equivalent to the expression <code>r = readline(prompt)</code>, except with defined signal-handling behavior.
It is a reasonably standard pattern for calling any library function (or syscall) when two things are true:

<ol>
<li>You want the call to end when a signal comes in
<li>You do not trust the function to cede control on its own
</ol>

<p>
This pattern arises because there is no universal behavior for what library functions, or syscalls, do when they are interrupted by a signal.
In some cases, the call will fail with an <code>EINTR</code> error, indicating it was interrupted, while in other cases the call will try to resume after the signal handler finishes.

<p>
Over the years, standard libraries across Unixes were inconsistent with which behavior they implemented.
This required applications like <i>es</i> that wanted consistent behavior between OSes to do this little <code>longjmp</code> dance to <em>force</em> control away from the call.
Since the &ldquo;bad old days&rdquo;, POSIX has largely standardized the behavior so that any call to, for example, <code>open(3)</code> will behave consistently between Unixes.

<p>
But not every function everywhere has settled on the same pattern, and readline is an example of a library that wants to try to handle signals itself without giving control to the calling application.
So, in order that signals can interrupt the prompt in <i>es</i>, we are forced to wrap the <code>readline()</code> call inside this block, and in fact wrap this block inside a loop, so that if a signal comes in that does not get turned into an exception, readline has a chance to restart.

<p>
Curiously, this use of <code>longjmp</code> from a signal handler is well-known and common, and also broadly considered unsafe.
That&rsquo;s C for you.

<h2 id=fds>File descriptors</h2>

<p>
Another distinctive part of <i>es</i> is its handling of file descriptors.

<p>
This results from a simple problem: shells generally give their users access to file descriptors identified by number.
This means that, if implemented in the naïve way, users have access to every file descriptor used by the shell, and can mess with those file descriptors in ways that are make it difficult for the shell to function or the user to reason about.

<p>
To prevent this, <i>es</i> presents a set of file descriptors to the user that differ from its own internal idea of them, and, when fork/execing, places the user-visible descriptors in the right places for the child processes.

<p>
As a side benefit, this user-fd/runtime-fd split also enables running shell built-ins within redirections without requiring a fork.
For example, the <code>$&amp;read</code> primitive starts with a call to <code>fdmap(0)</code>.
This call allows the primitive to work on the real file descriptor which its standard input appears to be, whether or not it&rsquo;s really fd 0, or some other file which has been redirected.

</main>
