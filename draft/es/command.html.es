<; cat tmpl/header.html >

<title>jpco.io | The life of an es command</title>
<meta name=description content="This page documents how a command in the extensible shell es goes from parsing to execution.">

<; build-nav >

<main>
<h1>The life of an <i>es</i> command</h1>
<div class=time><time datetime=REPLACEME>REPLACEME</time></div>

<p>
Like other Unix shells (and, really, any programming language), <i>es</i> commands go through a number of phases as they run, and understanding these phases is key to having a deep understanding of how the shell works as a whole.

<p>
Fortunately, there are fewer phases in <i>es</i> than some other shells, but we are going to go quite in depth here, including some discussion of shell internals.

<h2 id=life>The life of a command</h2>

<p>
The basic steps to evaluate a single command something like this.

<p>
First, the command is read from somewhere, and the parsed version of the command is produced by the <code>%parse</code> function.
This parsed command is represented internally as a <code>Tree</code>, a binary abstract syntax tree, which can represent any command.
So, for a command like

<figure class="bigfig centered">
<pre>
<code>echo &lt;={a = $path}</code>
</pre>
<figcaption>The command under investigation.</figcaption>
</figure>

<p>
the tree produced can be represented as:

<figure class="bigfig centered">
<pre>
<code>nList
 ├─ nWord ─ "echo"
 └─ nList
     ├─ nCall ─ nThunk ─ nAssign
     └─ (NULL)            ├─ nWord ─ "a"
                          └─ nList
                              ├─ nVar ─ nWord ─ "path"
                              └─ (NULL)</code>
</pre>
<figcaption>The AST representing the command <code>echo &lt;={a = $path}</code>.</figcaption>
</figure>

<p>
Each of these <code>nList</code>-like symbols is a different kind of <code>Tree</code> node: the top-level node, an <code>nList</code>, has two children, a <code>nWord</code> and another <code>nList</code>.
The <code>nWord</code> just has one child, the string <code>"echo"</code>, and so on.

<p>
A given node's type determines what its children are, and how many there are.
An <code>nWord</code> contains just a single string-valued child, which is the word itself, while an <code>nVar</code>, <code>nThunk</code> (the internal term for code fragment), or <code>nCall</code> contains a single <code>Tree</code> child, as each of those constructs can contain further recursively-nested constructs within them.
An <code>nList</code> or <code>nAssign</code> always has two <code>Tree</code> children, one of them potentially being <code>NULL</code>, which represent different things: <code>nList</code>s are laid out like <code>cons</code> cells, where the second child of an <code>nList</code> is always either another <code>nList</code> containing the remaining items in the list, or <code>NULL</code>; <code>nAssign</code>s, as expected, contain their variable name(s) in their first child and value(s) in their second.

<p>
Something important to note, demonstrated by this <code>Tree</code> in particular, is that it has not yet done anything to look up the value of <code>$path</code> or perform the assignment.
In general, the <code>Tree</code> form of a command hasn&rsquo;t been changed at all from how it was typed: Globbing has not been performed, variables remain un-looked-up, <code>&lt;={}</code> calls have not been made, and no code fragments or lambdas have been made into closures.
All of these behaviors are part of the next phase, known as <em>glomming</em>.

<p>
The core job of the glomming step is to convert a <code>Tree</code> command into a <code>List</code>.
A <code>List</code> is a linked list containing zero or more <code>Term</code>s, which correspond one-to-one with a command&lsquo;s name and arguments.

<p>
Doing this translation requires processing the complex nested structures which make up parts of a command before it is evaluated.
This processing includes:

<ul>
<li>Flattening lists
<li>Performing concatenation
<li>Resolving variables
<li>Getting the return values of commands invoked via <code>&lt;=</code>
<li>File globbing
<li>Closing over code fragments and lambdas (more on this later)
</ul>

<p>
Our example command is fairly short and simple: we have one plain word, <code>echo</code>, and one <code>&lt;={}</code> call.
The word <code>echo</code> is just turned directly into the first <code>Term</code>.
The <code>&lt;={}</code> call is more involved, but not terribly hard to gloss over; the shell evalutes the command <code>{a = $path}</code> and inserts the result of that command into our <code>List</code>.
For the purposes of this explanation, let&rsquo;s suppose that the current path is <code>(/bin /usr/bin)</code>.

<p>
So, the assignment is performed; <code>$a</code> now contains <code>(/bin /usr/bin)</code>, and the result of the assignment is that same value that has been assigned.
That result is received by our glom logic, which adds it to its output list after the <code>echo</code>, resulting in a <code>List</code> that is simply:

<figure class="bigfig centered">
<pre>
<code>echo /bin /usr/bin</code>
</pre>
<figcaption>The command <code>echo &lt;={a = $path}</code>, after glomming.</figcaption>
</figure>

<p>
The final step in a command's lifetime is its actual evaluation.
Evaluating a command can end up recursing back into tree-walking and glomming, particularly when evaluating lambdas, but we&rsquo;ll ignore those complicated cases for now and just look at the &ldquo;terminal&rdquo; types of commands which can be evaluated.

<p>
How a command is evaluated is based directly on its first term.

<ul>

<li>Some commands, the special syntactic forms like <code>let</code>, <code>~</code>, or assignments, are handled via special built-in behavior.

<li>Primitives have their corresponding built-in functions looked up in the shell&rsquo;s primitive table based on their name, and those functions are called with the rest of the command provided as arguments.

<li>Anything else is looked up as a function name; if a definition is found, then that definition replaces the function name in the command, and evaluation is retried.

<li>Anything not found by function lookup is presumed to be an external command.
If the command looks like an absolute path, then the shell will just try to run it.
If it doesn&rsquo;t, then the shell will call the <code>%pathsearch</code> hook to find the location of the command; assuming a result is produced, it is prepended on the command as a presumed path, and evaluation is retried.

</ul>

<p>
Our <code>echo</code> case is pretty simple.
Because <code>echo</code> is neither special syntax nor a primitive, the evaluation function <code>eval()</code> looks up <code>fn-echo</code> to determine what it is.
This lookup results in the <code>$&amp;echo</code> primitive.
That primitive is put in place of <code>echo</code>, such that the command is converted from

<figure>
<pre>
<code>echo /bin /usr/bin</code>
</pre>
</figure>

<p>
to

<figure>
<pre>
<code>$&amp;echo /bin /usr/bin</code>
</pre>
</figure>

<p>
On its second iteration, <code>eval()</code> finds the primitive, and <code>prim_echo()</code> is called with <code>/bin /usr/bin</code> as its argument list.

<p>
So, that is the basic lifetime of a command:

<ol>
<li>It is parsed and a <code>Tree</code> representation is produced
<li>Glomming converts that <code>Tree</code> to a <code>List</code>, resolving variables and other things along the way&mdash;potentially requiring other commands to be parsed, glommed, and evaluated while doing so
<li>If the resulting <code>List</code> is a special form or primitive, then it is evaluated in a built-in way
<li>Otherwise, the first term of the <code>List</code> is looked up as a function until it resolves to a special form, primitive, or external binary, and that is run
</ol>

<p>
This description gives enough context to discuss some of the finer points of evaluation which are useful to know.

<h2 id=closures>Glomming, code fragments, and closures</h2>

<p>
Consider a snippet of code like

<figure>
<pre>
<code>let (v = 'some list') {
	clo = {echo $v}
	str = '{echo $v}'
}
$clo
$str</code>
</pre>
</figure>

<p>
The <code>$clo</code> invocation prints &ldquo;<code>some list</code>&rdquo;, but the <code>$str</code> invocation just prints an empty line.
Why is that?

<p>
The technically-correct answer is because one is in quotes while the other isn&rsquo;t.
But that&rsquo;s not an explanation by itself, since in most respects, a quoted code fragment behaves identically to an unquoted one.
Given that, what makes the two commands differ in this particular case?
The answer is in how they are glommed.

<p>
When the <code>clo</code> and <code>str</code> assignments are evaluated, each value is first glommed before being assigned.
In the <code>str</code> case, the quoted word is simply glommed as a single, simple quoted word.
Later&mdash;outside of the <code>let</code>&mdash;when <code>$str</code> is invoked, <code>'{echo $v}'</code> is parsed into <code>{echo $v}</code>, which is then glommed and evaluated, with no value of <code>$v</code> in sight.
On the other hand, when the <code>clo</code> assignment is glommed, the <code>nThunk</code> of <code>{echo $v}</code> is turned into a <em>closure</em>, capturing the lexical binding of <code>$v</code> for when it is later used.

<p>
It can be seen seen more explicitly when the commands are printed instead of being assigned to variables:

<figure>
<pre>
<samp>; </samp><kbd>let (v = 'some list') echo {echo $v}</kbd>
<samp>%closure(v='some list'){echo $v}
; </samp><kbd>let (v = 'some list') echo '{echo $v}'</kbd>
<samp>{echo $v}
</pre>
</figure>

<p>
This closing-over behavior of glomming is critically important to <i>es</i>&rsquo; lexical binding semantics, and it only happens with code fragments and lambdas.
Fortunately, it almost always &ldquo;just works&rdquo;, so it&rsquo;s a detail that generally does not come up in normal use of the shell, and typically requires code that is a bit strange, like the above example, to become relevant.

</main>
