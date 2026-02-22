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
That is to say, <i>es</i> is a shell which features an exception mechanism, on which it relies for a number of uses, and getting a feel for that exception mechanism is a core part of proficiency in working with <i>es</i>.

<p>
Personally, when I first happened upon <i>es</i>, I thought the idea of an exception mechanism in a shell seemed a bit strange.
To my mind, it was overkill to have such a &ldquo;real&rdquo; programming-language concept in a shell.
What I didn&rsquo;t realize at the time was that exceptions make it possible to unify what would otherwise be a few, less-powerful, and separate mechanisms for non-structured control flow.

<h2>How exceptions work</h2>

<p>
An exception in <i>es</i> is a list.
The list&rsquo;s first element is its type.
There are a few exception types which have particular meaning to the shell: <code>break</code>, <code>eof</code>, <code>error</code>, <code>exit</code>, <code>retry</code>, <code>return</code>, and <code>signal</code>.

<p>
Depending on the type of exception, there are conventions for what the remaining list elements mean.
For example, the <code>error</code> exception&rsquo;s second element contains the name of the command which produced the error, and the remaining elements comprise an error message which can be used to understand the problem.

<p>
Raising exceptions in <i>es</i> is done with the <code>throw</code> function, or may be done by built-ins like <code>%parse</code> or anything which happens to raise an <code>error</code>.
Catching them is done with the <code>catch</code> command, which takes as arguments a <em>catcher</em>, which must be a lambda, and a <em>body</em>, which is typically a code fragment.
The body is evaluated and if an exception is raised then the catcher is evaluated with the raised exception as its arguments.
An exception can be re-raised from a catcher, to be caught by the catcher which wraps it.
If the <code>retry</code> exception is raised from a catcher, then instead of sending it &ldquo;up the chain&rdquo;, <code>catch</code> re-runs its body (more on <code>retry</code> later).

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
A verson of the <code>while</code> function, which catches the <code>break</code> exception and re-raises any others.
</figcaption>
</figure>

<p>
<code>catch</code> is not the only mechanism in <i>es</i> for catching exceptions.
Certain exceptions are automatically caught by different parts of the shell (more on those particulars in the descriptions of specific exceptions), but one other general exception-handling mechanism is important to mention.

<h3 id=unwind-protect><code>unwind-protect</code></h3>

<p>
The <code>unwind-protect</code> function is <i>es</i>&rsquo; cleanup mechanism.
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
<code>unwind-protect</code>, therefore, is used; its <code>cleanup</code> argument contains that removal, which runs whether or not an exception is raised from the body.

<p>
After the cleanup is run, what happens depends on how body exits.
If an exception was raised, then the same exception is re-raised.
Otherwise, after finishing, unwind-protect returns the result of the body.
This last point is part of what makes <code>unwind-protect</code> useful; rather than needing to explicitly cache the body&rsquo;s return value, it is done automatically.
It&rsquo;s a little bit magic (in the perjorative sense), but rather predicatble and almost always implicitly the right thing.

<h2>Control flow exceptions</h2>

<h3 id=eof><code>eof</code></h3>

<p>
The <code>eof</code> exception is raised by the <code>%parse</code> function when the shell reaches the end of its input, and it is caught by the REPL functions <code>%interactive-loop</code> and <code>%batch-loop</code>, which it causes to return.
It does not have any extra data associated with it.
The best thing to do with this exception is to ignore it: re-raise it if it is caught, and allow it to terminate whatever loop function it is meant for.

<p>
The existence of this exception implies that imitating the <code>ignoreeof</code> setting from csh should be possible.
This isn&rsquo;t the case right now, as any EOF received by <code>%parse</code> causes it to forever raise <code>eof</code>; enabling a form of <code>ignoreeof</code> is a follow-up for a later version of the shell.

<h3 id=break><code>break $value</code></h3>

<p>
The <code>break</code> exception exists to do what the <code>break</code> statement does in many languages: terminate the loop it&rsquo;s in.
It is caught by <code>for</code> and <code>while</code> (but not <code>forever</code>), and in both cases its argument list is used as the return value of the loop.

<p>
One problem with exceptions, which often appears in the use of <code>break</code>, is their <em>dynamic scope</em>.
This can be illustrated with a simple example:

<figure>
<pre>
<code>fn thrice cmd {
	for (i = 1 2 3) {
		$cmd
	}
}
while {true} {
	thrice {
		echo running cmd
		throw break
	}
}</code>
</pre>
</figure>

<p>
There is one <code>break</code> exception raised here, but two loops that it could interrupt.
If exceptions had lexical scope, then the <code>while</code> loop, which lexically encloses the <code>throw</code> call, would be interrupted.
However, exceptions have <em>dynamic</em> scope, so the <code>while</code> loop is the one that is interrupted.
This is a silly, contrived example, but in some cases it can be more confusing and unpleasant if it comes as a surprise as dynamic scope often is, so it is worthwhile to be aware of the behavior.

<h3 id=return><code>return $value</code></h3>

<p>
The <code>return</code> exception is similar to <code>break</code>, except instead of loops, it causes functions to exit with the raised exception&rsquo;s <code>$value</code>.
This includes named functions as well as anonymous lambda expressions, but critically, not regular code fragments.
So, these both catch the <code>return</code> raised in their bodies properly:

<figure>
<pre>
<code>fn func {
	echo printed
	return value
	echo not printed
}</code>
</pre>
</figure>

<figure>
<pre>
<code>@ {
	echo printed
	return value
	echo not printed
}</code>
</pre>
</figure>

<p>
But this doesn&rsquo;t, and the exception will be caught by its enclosing function (or the shell&rsquo;s top level):

<figure>
<pre>
<code>{
	echo printed
	return value
	echo not printed
}</code>
</pre>
</figure>

<p>
Sometimes, it is useful for a function to accept arguments but not catch <code>return</code>.
This is true for <code>while</code>, <code>%not</code>, <code>%and</code>, <code>%or</code>, and many other cases where functions are used as syntax or other not-traditionally-a-function uses.
In these cases, the <code>$&amp;noreturn</code> primitive is useful to define a function that doesn&rsquo;t catch <code>return</code>:

<figure>
<pre>
<code>fn-%not = $&amp;noreturn @ cmd {
	if {$cmd} {false} {true}
}</code>
</pre>
</figure>

<h3 id=retry><code>retry</code></h3>

<p>
The <code>retry</code> exception is a unique exception which, when caught by the <code>catch</code> command while running its catcher, will cause the body to be re-run.
It is used primarily in the <code>%interactive-loop</code> function.
In the following example, <code>try-something</code> will be run repeatedly until it completes without raising an exception.

<figure>
<pre>
<code>catch @ {
	throw retry
} {
	try-something
}</code>
</pre>
</figure>

<p>
Here is where I will begin editorializing: <code>retry</code> should be removed from <i>es</i>.
As seen in the <code>while</code> example earlier, it is common practice for a catcher to re-raise exceptions, and <code>retry</code> almost never interacts correctly with that.
Functions built around exception handling, such as <code>unwind-protect</code>, have to be significantly more complicated in their implementations in order to handle <code>retry</code> sensibly.

<p>
These pitfalls would be justifiable if <code>retry</code> were critically useful, but it isn&rsquo;t: <code>throw retry</code> is rarely used outside of REPL functions, and it is actually <em>never</em> necessary, as the same behavior can be achieved by placing the handler inside a loop!

<p>
In short: <code>retry</code> is unnecessary and difficult, since it very occasionally turns <code>catch</code> into an ersatz looping construct, when <i>es</i> already has perfectly good constructs for loops that would cause far less difficulty.

<h2 id=signal>The <code>signal</code> exception</h2>

<p>
There&rsquo;s a lot to talk about with <code>signal</code>

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
