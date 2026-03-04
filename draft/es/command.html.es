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

<p>
First, some pre-requisite knowledge: Most behaviors in <i>es</i> are various wrappers around commands that look something like

<figure>
<pre>
<code>; command arg arg arg</code>
</pre>
</figure>

<p>
There are some exceptions, such as <code>let</code>, <code>~</code> (the matching construct), or assignments, but for the most part everything wraps a simple command which takes arguments, even things that look more complicated, such as pipes or redirections.

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
the tree produced is:

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
Types of tree node are identified by a symbol such as <code>nList</code>.  Different node types can contain different types and numbers of children: An <code>nWord</code> contains just a single string child, which is the word itself.
An <code>nVar</code>, <code>nThunk</code> (the internal term for code fragment), or <code>nCall</code> contains a single <code>Tree</code> child, as each of those constructs can contain further recursively-nested constructs within them.
An <code>nList</code> or <code>nAssign</code> always has two <code>Tree</code> children, one of them potentially being <code>NULL</code>, which represent different things: <code>nList</code>s are laid out like <code>cons</code> cells, where the second child of an <code>nList</code> is always either another <code>nList</code> containing the remaining items in the list, or <code>NULL</code>; <code>nAssign</code>s, as expected, contain their variable name(s) in their first child and value(s) in their second.

<p>
Something important to note, demonstrated by this <code>Tree</code> in particular, is that it has not yet done anything to look up the value of <code>$path</code> or perform the assignment.
In general, the <code>Tree</code> form of a command hasn&rsquo;t been changed at all from how it was typed: Globbing has not been performed, variables remain un-looked-up, <code>&lt;={}</code> calls have not been made, and no code fragments or lambdas have been made into closures.
All of these behaviors are part of the next phase, known as <em>glomming</em>.

<p>
The core job of the glomming step is to convert a <code>Tree</code> command into a <code>List</code>, since <code>List</code>s are what the shell can actually evaluate.
To do this translation requires evaluating some of the nested structures into outputs that can be evaluated.
Types of processing performed include:

<ul>
<li>Flattening lists
<li>Concatenating
<li>Resolving variables
<li>Getting the return values of commands via <code>&lt;=</code>
<li>File globbing
<li>Closing over code fragments and lambdas (more on this later)
</ul>

<p>
Our command is fairly short and simple: we have one plain word, <code>echo</code>, and one <code>&lt;=</code> call.
The word <code>echo</code> is just turned directly into a <code>Term</code> in the <code>List</code>.
The <code>&lt;=</code> is more involved, but not terribly hard to explain; the shell simply recursively evalutes the command <code>{a = $path}</code> and splats the result of that command into our <code>List</code>.
For the purposes of this explanation, let&rsquo;s suppose that the current path is <code>/bin /usr/bin</code>.

<p>
So, the assignment is performed; <code>$a</code> now contains <code>/bin /usr/bin</code>, and the result of the assignment is that same value that has been assigned.
That result is received by our glom logic, which adds it to its output list after the <code>echo</code>, resulting in a <code>List</code> that is simply:

<figure class="bigfig centered">
<pre>
<code>echo /bin /usr/bin</code>
</pre>
<figcaption>The command <code>echo &lt;={a = $path}</code>, after glomming.</figcaption>
</figure>

<p>
The final step is the actual evaluation.
Evaluating a command can end up recursing back into tree-walking and glomming, particularly when evaluating lambdas, but we&rsquo;ll ignore those recursive cases for now and just look at the &ldquo;terminal&rdquo; types of commands which can be evaluated.

<p>
How a command is evaluated is based directly on its first term.

<ul>

<li>Some commands, the special syntactic forms like <code>let</code>, <code>~</code>, or assignments, are handled via special functions.

<li>Primitives have their corresponding functions looked up in the primitive table based on their name, and those functions are called with the rest of the command as arguments.

<li>Anything else is looked up as a function; if a function definition is found, then that definition replaces the function name in the command, and evaluation is retried.

<li>Anything not found by function lookup is presumed to be an external command.
If the command looks like an absolute path, then the shell will just try to run it.
If it doesn&rsquo;t, then the shell will call the <code>%pathsearch</code> hook to find the location of the command; assuming a result is produced, then it will be prepended on the command as a presumed path.

</ul>

<p>
Our <code>echo</code> case is pretty simple.
<code>eval()</code> first looks up <code>fn-echo</code>, resulting in (typically) the <code>$&amp;echo</code> primitive.
That primitive is put in place of <code>echo</code>, such that the command has gone from

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
<li>If the resulting <code>List</code> is a special form, that is evaluated specially
<li>Otherwise, the first term of the <code>List</code> is looked up as a function until it resolves to a special form, primitive, or external binary, and that is run.
</ol>

<p>
This description gives enough context to discuss some of the finer points of evaluation which are important to know.

<h2 id=closures>Glomming, code fragments, and closures</h2>

<p>
Consider a snippet of code like

<figure>
<pre>
<code>let (v = some list) {
	clo = {echo $v}
	str = '{echo $v}'
}
$clo
$str</code>
</pre>
</figure>

<p>
The <code>$clo</code> invocation prints <code>some list</code>, but the <code>$str</code> invocation just prints an empty line.
Why is that?

<p>
The short, obvious answer is because one is in quotes while the other isn&rsquo;t.
But that&rsquo;s not an explanation by itself, since in many ways, a quoted code fragment behaves identically to an unquoted one, so what <em>actually</em> differs between these two cases here?
The answer is in how the two are glommed.

<p>
When the <code>clo</code> and <code>str</code> assignments are performed, the left and right sides of both assignments are glommed before the assignment is performed.
In the <code>str</code> case, the quoted word is simply glommed as a quoted word.
Later&mdash;outside of the <code>let</code>&mdash;when <code>$str</code> is invoked, <code>'{echo $v}'</code> is parsed into <code>{echo $v}</code>, which is glommed and evaluated with no value of <code>$v</code> in sight, so an empty line is produced.
On the other hand, when the <code>clo</code> assignment is glommed, the <code>nThunk</code> of <code>{echo $v}</code> is turned into a <em>closure</em>, capturing the lexical binding of <code>$v</code> for when it is later used.

<p>
This behavior is an unfortunately tricky case that arises from <i>es</i>&rsquo; free conversion between strings and code combined with its handling of lexical binding.
However, it can sometimes also be exploited by a user who wants to avoid capturing lexical scope in a spot.

</main>
