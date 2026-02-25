<; cat tmpl/header.html >

<title>jpco.io | The life of an es command</title>
<meta name=description content="This page documents how a command in the extensible shell es goes from parsing to execution.">

<; build-nav /es/command.html >

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

<p>
The basic steps are something like this:

<p>
First, a command is read from somewhere, and the parsed version of the command is produced by the <code>%parse</code> function.
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
Different types of tree node can contain different types and numbers of children: An <code>nWord</code> contains just a single string child, which is the word itself.
An <code>nVar</code>, <code>nThunk</code>, or <code>nCall</code> contains a single <code>Tree</code> child, as each of those constructs can contain further recursively-nested constructs within them.
An <code>nList</code> or <code>nAssign</code> always has two <code>Tree</code> children, one of them potentially being <code>NULL</code>, which represent different things: <code>nList</code>s are laid out like <code>cons</code> cells, where the second child of an <code>nList</code> is always either another <code>nList</code> containing the remaining items in the list, or <code>NULL</code>; <code>nAssign</code>s, as expected, contain their variable name(s) in their first child and value(s) in their second.

<p>
Something important to note, demonstrated by this <code>Tree</code> in particular, is that it has not yet done anything to look up the value of <code>$path</code> or perform the assignment.
In general, at this stage, the command hasn&rsquo;t been &ldquo;touched&rdquo; at all yet.
Globbing has not been performed, variables remain un-resolved, and no code fragments or lambdas have been made into closures.
All of these behaviors are part of the next phase, known as <em>glomming</em>.

<p>
The glomming step, at its most basic, converts a <code>Tree</code> command into a <code>List</code>, since <code>List</code>s are what the shell can actually evaluate.
To do so, the shell often needs to recursively process its arguments.

<p>
In our example, the <code>echo</code> term is easy, since it&rsquo;s just an <code>nWord</code>; the first <code>Term</code> of the resulting <code>List</code> must, of course, just be <code>echo</code>.
The second word is quite a bit more complicated, because we don&rsquo;t want to put the <code>nCall</code> into our list to evaluate, but instead to make the call and put its <em>result</em> into the list.
To achieve this, we have to evaluate the thunk, which just means evaluating the assignment, and to do that, we need to glom the terms of both sides of the assignment; glomming the variable name <code>a</code> just produces itself, but glomming the value <code>$path</code> requires actually looking up the value of the variable in the current context.
Let&rsquo;s suppose that the current path is <code>/bin /usr/bin</code>.

<p>
So, the assignment is performed; <code>$a</code> is now <code>/bin /usr/bin</code>, and the return value of the assignment is that same value.
That return value makes it to the outermost glom, which adds it to its output list, and since there&rsquo;s no more <code>Tree</code> to glom, it&rsquo;s done, with a final <code>List</code> of:

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

<ol>
<li>Some commands, the special syntactic forms like <code>let</code>, <code>~</code>, or assignments, are handled via special functions.

<li>Primitives have their corresponding functions looked up in the primitive table based on their name, and those functions are called with the rest of the command as arguments.

<li>Anything else is looked up as a function; if a function definition is found, then that definition replaces the function name, and evaluation is retried with the new list.

<li>Anything not found as a function is presumed to be an external command.
If the command looks like an absolute path, then the shell will just try to run it.
If it doesn&rsquo;t, then the shell will call the <code>%pathsearch</code> hook to find the location of the command; assuming a result is produced, then it will be prepended on the command as a presumed path.

</ol>

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

</main>
