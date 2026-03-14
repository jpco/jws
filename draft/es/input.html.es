<; cat tmpl/header.html >

<title>jpco.io | Input to es is not what it could be</title>
<meta name=description content="This page discusses how input works in the extensible shell es, and how it is being improved.">

<; build-nav >

<main>
<h1>Input to <i>es</i> is not what it could be</h1>
<div class=time><time datetime=REPLACEME>REPLACEME</time></div>

<p>
One area of <i>es</i> which is extremely lacking compared to other shells is how it reads input.
Whereas interactive features tend to be the major attractive feature of many shells (those shells often being limited to POSIX-compatibility in the language itself), in <i>es</i> the support for interactivity is meager.

<p>
This is in part intentional; <i>es</i>, coming from <i>rc</i>, tries to be relatively minimal in its behaviors by default.
Unlike, say, <a href="https://fishshell.com">fish</a>, the default behavior when dropping into <i>es</i> for the first time is always probably going to be a simple prompt.

<figure>
<pre>
<samp>; </samp>
</pre>
</figure>

<p>
However, defaults aside, <i>es</i> is meant to be <em>extensible</em>.
Even if the default behavior is lean or simplistic, there is no particular virtue in making it impossible for a user to get a more advanced interactive setup akin to fish, if that&rsquo;s what they want.
The major reasons for the lack of extensiblity in <i>es</i> today are all accidents of implementation.

<h2>How input works</h2>

<p>
Like other shells, <i>es</i> can be given shell input in a few forms: a raw string (<code>es -c</code>); a named file (<code>es script.es</code>, or <code>. script.es</code>); or standard input, either non-interactively (<code>curl | es</code>) or interactively at a terminal.
When started (or a script is run with <code>.</code>), the shell creates a new <code>Input</code> object corresponding with the file or string the shell is meant to read and evaluate.

<p>
It binds the <code>%dispatch</code> function to a definition based on the <code>-enx</code> flags the user gave when starting the shell or calling the <code>.</code> function.
This function takes a command and typically just runs it, but occasionally does other things, such as printing the command when <code>-x</code> is given.

<p>
Then, depending on if the input is meant to be read interactively or not, the shell calls either <code>%interactive-loop</code> or <code>%batch-loop</code>.
Finally, at this point, users have some control over what happens.

<p>
The REPL functions are important (and complicated) enough that they deserve their own page documenting them, but at their heart is a loop containing a bit of code that looks something like this:

<figure>
<pre>
<code>let (cmd = &lt;={%parse $prompt}) {
	if {!~ $#cmd 0} {
		$fn-%dispatch $cmd
	}
}</code>
</pre>
</figure>

<p>
In this block, the <code>%parse</code> function is called and its result&mdash;a command which has just been read from the shell&rsquo;s <code>Input</code> and is intended to be run&mdash;is bound to the variable <code>cmd</code>.
If <code>$cmd</code> is not empty, the <code>%dispatch</code> function is called in order to evaluate it appropriately.

<p>
When looking at these functions, the <code>%parse</code> part is fairly inscrutable.
An obvious question is: Why does a function called <code>%parse</code> take the shell&rsquo;s <code>$prompt</code> as arguments, when the prompt has nothing really to do with parsing?
Also, where is the code to actually read from the shell&rsquo;s input?
Well, that&rsquo;s the problem:

<h2><code>%parse</code> does too much</h2>

<p>
Given what the <code>$&amp;parse</code> primitive actually does, it would more accurately be called <code>$&amp;readfromshellinputandparse</code>.
<code>$&amp;parse</code> does do what it claims to, <em>parse</em> unstructured input to produce a shell syntax tree, but to actually get at that input, it reads from the special shell <code>Input</code> using either special buffered read logic (which can&rsquo;t be used anywhere else) or <code>readline(3)</code> (which also can&rsquo;t be called any other way).
And, of course, anybody who has worked with readline knows that it is a distinctly verbose pleasure to do so.
On top of that, the way <i>es</i> been historically implemented, <em>no es script can be invoked</em> while <code>$&amp;parse</code> is running, which includes when the shell is reading its input.

<p>
The reason for this is memory management.
<i>Es</i> needs to track every bit of shell state for the sake of its garbage collector, but while the yacc-generated parser is running, some bits of shell state held by the parser will be unknown to <i>es</i> until parsing is complete, meaning that the GC can&rsquo;t run during parsing, meaning that normal <i>es</i> code can&rsquo;t be run while the parser is going.

<p>
This stinks!
So much happens inside of <code>$&amp;parse</code>, and so much of that is made up by mysterious internal mechanisms (the <code>Input</code>) which are barely in the user&rsquo;s control, that it is essentially only usable within the context of these REPL functions.
(Exercise for the reader: figure out a way to wrap <code>%parse</code> such that it can be fed an arbitrary string.)
Because it has readline wrapped up in it, there&rsquo;s no <code>$&amp;readline</code> primitive that users can call, either&mdash;and no way at all to use readline to get any input that won&rsquo;t then be passed into the parser.
In a shell which has been praised for its <a href="http://www.catb.org/~esr/writings/taoup/html/ch04s02.html#orthogonality">orthogonality</a>, this is a glaring deficiency.

<p>
Forgetting the existing implementation, let&rsquo;s look at what a hypothetical <code>$&amp;parse</code> should do.
At first blush, we want a <code>$&amp;parse</code> which

<ol>
<li>takes as its input unstructured <i>es</i> code, and
<li>returns a structured AST.
</ol>

<p>
For most languages, including <i>es</i>, it&rsquo;s actually impossible to know without parsing how much input the parser needs before it&rsquo;s done, because it depends directly on the syntactic structure of the input.
Because of that problem, you can&rsquo;t just pretend a parser is a black box where you feed it a string and it spits out a tree; it needs some way to ask for more input.

<p>
With that in mind, how would we change <code>$&amp;parse</code>?
There are two directions that parsers take to do this, either of which could be used for <i>es</i>.

<p>
A <em>push-style</em> parser is one where you get some input, push it into the parser, and check if that was enough input to get something out.
In <i>es</i> the basic setup might look like:

<figure>
<pre>
<code>let (line = (); cmd = ()) {
	while {~ $cmd ()} {
		line = &lt;=%read
		cmd = &lt;={%parse $line}
	}
	$fn-%dispatch $cmd
}</code>
</pre>
</figure>

<p>
This is more complicated-looking than the above, but there&rsquo;s also a serious catch: now you have to worry about the state of the parser between calls.
Because each <code>%parse</code> call can leave the parser in a partially-done state, in order to have reliably correct behavior, you&rsquo;d actually need to add some kind of <code>%parse-init</code> function.
You may even want to have some kind of parser handle where the parser code can be encapsulated.

<p>
This starts to get legitimately complicated, and can all be avoided by using the other style of parser: <em>pull-style</em>.
This is how the internal yacc-generated parser in <i>es</i> works.
As a user, you just call the parser, and you give it a way to fetch input itself when it needs more.
In <i>es</i>, this might look like:

<figure>
<pre>
<code>let (cmd = &lt;={%parse %read}) {
	if {!~ $#cmd 0} {
		result = &lt;={$fn-%dispatch $cmd}
	}
}</code>
</pre>
</figure>

<p>
The change from the current state of the shell to this is very subtle&mdash;we&rsquo;ve just gone from the original <code>%parse $prompt</code> to <code>%parse %read</code>.
In this case, <code>%read</code> is a command that we give to <code>%parse</code>, which it can call whenever it wants to read more shell input.
This command will be called at least once, and might be called a hundred times, until the parser finishes.
This setup fixes the problems with state that the push-style parser would have, as every call to <code>%parse</code> would run until the parser reached a complete state.

<p>
Actually, a more complete version of <code>%parse</code> (one which externally resembles the current <code>$&amp;parse</code> primitive, but uses a <code>$&amp;parse</code> which takes a reader command as input) would look like:

<figure>
<pre>
<code>fn %parse prompt {
	if %is-interactive {
		let (in = (); p = $prompt(1))
		unwind-protect {
			$&amp;parse {
				let (r = &lt;={$&amp;readline $p}) {
					in = $in $r
					p = $prompt(2)
					result $r
				}
			}
		} {
			if {!~ $#fn-%write-history 0} {
				%write-history &lt;={%flatten \n $in}
			}
		}
	} {
		$&amp;parse $&amp;read
	}
}</code>
</pre>
</figure>

</main>
