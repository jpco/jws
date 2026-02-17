<; cat tmpl/header.html >

<title>jpco.io | Exceptions in the extensible shell</title>
<meta name=description content="This page explores the use of the exception mechanism in the extensible shell es">

<; build-nav /es/exceptions.html >

<main>
<h1>The <del>Extensible</del><ins>Exceptional</ins> Shell</h1>
<div class=time><time datetime="TODO">TODO</time></div>

<p>
<i>Es</i> is the exceptional shell.

<p>
That is to say, <i>es</i> features an exception mechanism, on which it relies for a number of uses, and getting a feel for that exception mechanism is a core part of proficiency in working with <i>es</i>.

<p>
Personally, when I first happened upon <i>es</i>, I thought the idea of an exception mechanism in a shell seemed a bit strange.
To my mind, it was overkill to have such a &ldquo;real&rdquo; programming-language concept in a shell.
What I didn't realize at the time was that exceptions make it possible to unify what would otherwise be a few, less-powerful, and separate mechanisms for non-structured control flow.

<h2>How exceptions work</h2>

<p>
An exception in <i>es</i> is a list.
The list's first element is its type.
There are a few exception types which have particular meaning to the shell: <code>break</code>, <code>eof</code>, <code>error</code>, <code>exit</code>, <code>retry</code>, <code>return</code>, and <code>signal</code>.

<p>
Depending on the type of exception, there are conventions for what the remaining list elements mean.
For example, the <code>error</code> exception's second element contains the name of the command which produced the error, and the remaining elements comprise an error message which can be used to understand the problem.

<p>
Throwing exceptions in <i>es</i> is done with the <code>throw</code> function, or may be done by built-ins like <code>%parse</code> or anything which happens to throw an <code>error</code>.
Catching them is done with the <code>catch</code> command, which takes as arguments a <em>catcher</em>, which must be a lambda, and a <em>body</em>, which is typically a code fragment.
The body is evaluated and if an exception is thrown then the catcher is evaluated with the thrown exception as its arguments.
An exception can be re-thrown from a catcher.
If the <code>retry</code> exception is thrown from a catcher, then <code>catch</code> re-runs the body (more on <code>retry</code> later).

<figure class=centered>
<pre>
<code>fn-while = $&amp;noreturn @ cond body {
	catch @ e value {
		if {~ $e break} {
			result $value
		} {
			throw $e $value
		}
	} {
		let (result = &lt;=true)
		forever {
			if {!$cond} {
				throw break $result
			} {
				result = &lt;=$body
			}
		}
	}
}</code>
</pre>
<figcaption>
A verson of the <code>while</code> function, which catches the <code>break</code> exception and re-throws any others.
</figcaption>
</figure>

<p>
<code>catch</code> is not the only mechanism in <i>es</i> for catching exceptions.
Certain exceptions are automatically caught by different parts of the shell (more on those particulars in the descriptions of specific exceptions), but one other general exception-handling mechanism is important to mention.

<h3 id=unwind-protect><code>unwind-protect</code></h3>

<p>
The <code>unwind-protect</code> function is <i>es</i>' cleanup mechanism.
It takes two arguments: a body and a cleanup command.
An example of its use is in a definition of the <code>%readfrom</code> function:

<figure class=centered>
<pre>
<code>fn-%readfrom = $&amp;noreturn @ var input cmd {
	local ($var = /tmp/es.$var.$pid)
	unwind-protect {
		$input &gt; $$var
		# text of $cmd is   command file
		$cmd
	} {
		rm -f $$var
	}
}</code>
</pre>
<figcaption>
A version of <code>%readfrom</code>.
Note here that <code>$&amp;noreturn</code> is used, like in the previous example.
</figcaption>
</figure>

<p>
This function, which is what the <code>&lt;{cmd}</code> input/output substitution syntax desugars into, takes a variable name and two commands as input.
It sets the variable name to a temporary file, runs the <code>$input</code> command with its output redirected to the file, and then runs the body command <code>$cmd</code>.

<p>
The problem to be solved is that this temporary file needs to be removed when the command finishes, but something might happen during <code>$cmd</code> which interrupts the process.
<code>unwind-protect</code>, therefore, is used; its <code>cleanup</code> argument contains that removal, which runs whether or not an exception is thrown from the body.

<p>
After the cleanup is run, what happens depends on how body exits.
If an exception was thrown, then the same exception is re-thrown.
Otherwise, after finishing, unwind-protect returns the result of the body.
This last point is part of what makes <code>unwind-protect</code> useful; rather than needing to explicitly cache the body's return value, it is done automatically.
It's a little bit magic (in the perjorative sense), but rather predicatble and almost always implicitly the right thing.

<h2>Control flow exceptions</h2>

<h3 id=eof><code>eof</code></h3>

<p>
The <code>eof</code> exception is thrown by the <code>%parse</code> function when the shell reaches the end of its input, and it is caught by the REPL functions <code>%interactive-loop</code> and <code>%batch-loop</code>, which it causes to return.
It does not have any extra data associated with it.
The best thing to do with this exception is to ignore it: re-throw it if it is caught, and allow it to terminate whatever loop function it is meant for.

<p>
The existence of this exception implies that imitating the <code>ignoreeof</code> setting from csh should be possible.
This isn't the case right now, as any EOF received by <code>%parse</code> causes it to forever throw <code>eof</code>; enabling a form of <code>ignoreeof</code> is a follow-up for a later version of the shell.

<h3 id=break><code>break $value</code></h3>

<p>
The <code>break</code> exception exists to do what the <code>break</code> statement does in many languages: terminate the loop it's in.
It is caught by <code>for</code> and <code>while</code>, and in both cases its argument list is used as the return value of the loop.

<p>
Mention pitfalls with dynamic scope here?

<h3 id=return><code>return $value</code></h3>

<p>
Don't forget to bring up <code>$&amp;noreturn</code>

<h3 id=retry><code>retry</code></h3>

<p>
<code>retry</code> is a mess

<h2 id=signal>The <code>signal</code> exception</h2>

<p>
There's a lot to talk about with <code>signal</code>

<p>
Signal blocking

<p>
Exit status

<h2>The <code>error</code>, <code>exit</code>, and <code>false</code> exceptions</h2>

<h3 id=error><code>error $type $message</code></h3>

<p>
<code>error</code> is pretty straightforward

<h3 id=exit><code>exit $value</code></h3>

<p>
Honestly <code>exit</code> is also pretty straightforward, <em>except</em>...

<h3 id=false><code>false $value</code></h3>

<p>
<code>false</code> does not exist.
