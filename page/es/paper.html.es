<; cat tmpl/header.html >

<style>
figure.bigfig {
  text-align: center;
  padding-top: 1ex;
  padding-bottom: 1ex;
  border-top: 1px solid #bbb;
  border-bottom: 1px solid #bbb;
}
kbd {
	font-style: oblique;
}
</style>

<title>jpco.io | Es: A shell with higher-order functions</title></head>
<meta name=description content="Es: A shell with higher-order functions.  Written by Paul Haahr and Byron Rakitzis for Usenet 1993." />

<; . script/build-nav.es /es/paper.html >

<main>
<h1><i>Es</i>: A shell with higher-order functions</h1>

<!-- TODO: rename this class -->
<div class=time>
<a href="mailto:paul@paulhaahr.com"><i>Paul Haahr</i></a>
&mdash; Adobe Systems Incorporated
[<a class=local href=#erratum1 id=erratum1-use>Errata note 1</a>]
<br>
<a href="http://www.rakitzis.com/resume.html"><i>Byron Rakitzis</i></a>
&mdash; Network Appliance Corporation
</div>

<h2><a id=abstract>Abstract</a></h2>

<p>
In the fall of 1990, one of us (Rakitzis) re-implemented the Plan 9
command interpreter, <i>rc</i>, for use as a UNIX shell.
Experience with that shell led us to wonder whether a more general
approach to the design of shells was possible, and this paper
describes the result of that experimentation. We applied concepts
from modern functional programming languages, such as Scheme and ML,
to shells, which typically are more concerned with UNIX
features than language design. Our shell is both simple and highly
programmable. By exposing many of the internals and adopting
constructs from functional programming languages, we have created a
shell which supports new paradigms for programmers.

<p>
<b>Note:</b>
This web page is an HTML version of a paper which was presented at the
Winter 1993 Usenix Conference in San Diego, California.
The paper corresponds to an out-of-date release of <i>es</i>;  see
the Errata section for changes which affect parts of the paper.
<a href="https://github.com/wryun/es-shell">
Source code for the current version of <i>es</i></a> is available on
GitHub.

<h2><a id=table-of-contents>Table of Contents</a></h2>

<ul>
<li><a class=local href=#introduction>Introduction</a>
<li><a class=local href=#using-es-commands>Using <i>es</i> Commands</a>
<li><a class=local href=#functions>Functions</a>
<li><a class=local href=#variables>Variables</a>
<li><a class=local href=#binding>Binding</a>
<li><a class=local href=#settor-variables>Settor Variables</a>
<li><a class=local href=#return-values>Return Values</a>
<li><a class=local href=#exceptions>Exceptions</a>
<li><a class=local href=#spoofing>Spoofing</a>
<li><a class=local href=#implementation>Implementation</a>
<li><a class=local href=#initialization>Initialization</a>
<li><a class=local href=#the-environment>The Environment</a>
<li><a class=local href=#interactions-with-unix>Interactions With UNIX</a>
<li><a class=local href=#garbage-collection>Garbage Collection</a>
<li><a class=local href=#future-work>Future Work</a>
<li><a class=local href=#conclusions>Conclusions</a>
<li><a class=local href=#acknowledgements>Acknowledgements</a>
<li><a class=local href=#footnotes>Footnotes</a>
<li><a class=local href=#errata>Errata</a>
<li><a class=local href=#references>References</a>
<li><a class=local href=#author-information>Author Information</a>
</ul>

<hr>

<p>

<blockquote>
Although most users think of the shell as an interactive command
interpreter, it is really a programming language in which each
statement runs a command. Because it must satisfy both the interactive
and programming aspects of command execution, it is a strange
language, shaped as much by history as by design.</blockquote>
<p>&mdash; Brian Kernighan &amp; Rob Pike [<a class=local href=#ref1>1</a>]

<h2><a id=introduction>Introduction</a></h2>

<p>
A shell is both a programming language and the core of an interactive
environment. The ancestor of most current shells is the 7th Edition
Bourne shell[<a class=local href=#ref2>2</a>], which is characterized by simple
semantics, a minimal set of interactive features, and syntax that is
all too reminiscent of Algol. One recent shell, <i>rc</i>
[<a class=local href=#ref3>3</a>], substituted a cleaner syntax but kept most of
the Bourne shell's attributes. However, most recent developments in
shells (e.g., <i>csh</i>, <i>ksh</i>, <i>zsh</i>) have focused on
improving the interactive environment without changing the structure
of the underlying language &mdash; shells have proven to be resistant
to innovation in programming languages.

<p>
While <i>rc</i> was an experiment in adding modern syntax to Bourne
shell semantics, <i>es</i> is an exploration of new semantics combined
with <i>rc</i>-influenced syntax:  <i>es</i> has lexically scoped
variables, first-class functions, and an exception mechanism, which
are concepts borrowed from modern programming languages such as Scheme
and ML.  [<a class=local href=#ref4>4</a>, <a class=local href=#ref5>5</a>]

<p>
In <i>es</i>, almost all standard shell constructs (e.g., pipes and
redirection) are translated into a uniform representation: function
calls. The primitive functions which implement those constructs can be
manipulated the same way as all other functions: invoked, replaced, or
passed as arguments to other functions.  The ability to replace
primitive functions in <i>es</i> is key to its extensibility; for
example, a user can override the definition of pipes to cause remote
execution, or the path-searching machinery to implement a path look-up
cache.

<p>
At a superficial level, <i>es</i> looks like most UNIX
shells. The syntax for pipes, redirection, background jobs, etc., is
unchanged from the Bourne shell.  <i>Es</i>'s programming constructs
are new, but reminiscent of <i>rc</i> and Tcl[<a class=local href=#ref6>6</a>].

<p>
<i>Es</i> is freely redistributable, and is available by anonymous ftp
from <code>ftp.white.toronto.edu</code>.

<h2><a id=using-es-commands>Using <i>es</i> Commands</a></h2>

<p>
For simple commands, <i>es</i> resembles other shells. For
example, newline usually acts as a command terminator.  These are
familiar commands which all work in <i>es</i>:

<figure>
<pre>
<code>cd /tmp
rm Ex*
ps aux | grep '^byron' | awk '{print $2}' | xargs kill -9</code>
</pre>
</figure>

<p>
For simple uses, <i>es</i> bears a close resemblance to <i>rc</i>.
For this reason, the reader is referred to the paper on <i>rc</i> for
a discussion of quoting rules, redirection, and so on. (The examples
shown here, however, will try to aim for a lowest common denominator
of shell syntax, so that an understanding of <i>rc</i> is not a
prerequisite for understanding this paper.)

<h2><a id=functions>Functions</a></h2>

<p>
<i>Es</i> can be programmed through the use of shell functions. Here
is a simple function to print the date in <i>yy-mm-dd</i> format:

<figure>
<pre>
<code>fn d {
  date +%y-%m-%d
}</code>
</pre>
</figure>

<p>
Functions can also be called with arguments.  <i>Es</i> allows
parameters to be specified to functions by placing them between the
function name and the open-brace. This function takes a command
<code>cmd</code> and arguments <code>args</code> and applies the
command to each argument in turn:

<figure>
<pre>
<code>fn apply cmd args {
  for (i = $args)
    $cmd $i
}</code>
</pre>
</figure>

<p>
For example: [<a class=local href=#footnote1 id=footnote1-use>Footnote 1</a>]

<figure>
<pre>
<samp>es&gt; </samp><kbd>apply echo testing 1.. 2.. 3..</kbd>
<samp>testing
1..
2..
3..</samp>
</pre>
</figure>

<p>
Note that <code>apply</code> was called with more than two arguments;
<i>es</i> assigns arguments to parameters one-to-one, and any
leftovers are assigned to the last parameter. For example:

<figure>
<pre>
<samp>es&gt; </samp><kbd>fn rev3 a b c {
echo $c $b $a
}</kbd>
<samp>es&gt; </samp><kbd>rev3 1 2 3 4 5</kbd>
<samp>3 4 5 2 1</samp>
</pre>
</figure>

<p>
If there are fewer arguments than parameters, <i>es</i> leaves the
leftover parameters null:

<figure>
<pre>
<samp>es&gt; </samp><kbd>rev3 1</kbd>
<samp>1</samp>
</pre>
</figure>

<p>
So far we have only seen simple strings passed as arguments. However,
<i>es</i> functions can also take program fragments (enclosed in
braces) as arguments. For example, the <code>apply</code> function
defined above can be used with program fragments typed directly on the
command line:

<figure>
<pre>
<samp>es&gt; </samp><kbd>apply @ i {cd $i; rm -f *} /tmp /usr/tmp</kbd>
</pre>
</figure>

<p>
This command contains a lot to understand, so let us break it up
slowly.

<p>
In any other shell, this command would usually
be split up into two separate commands:

<figure>
<pre>
<samp>es&gt; </samp><kbd>fn cd-rm i {
  cd $i
  rm -f *
}</kbd>
<samp>es&gt; </samp><kbd>apply cd-rm /tmp /usr/tmp</kbd>
</pre>
</figure>

<p>
Therefore, the construct

<figure>
<pre>
<code>@ i {cd $i; rm -f *}</code>
</pre>
</figure>

<p>
is just a way of inlining a function on the
command-line. This is called a <em>lambda</em>.
[<a class=local href=#footnote2 name=footnote2-use>Footnote 2</a>]
It takes the form

<figure>
<code>@ <var>parameters</var> { <var>commands</var> }</code>
</figure>

<p>
In effect, a lambda is a procedure "waiting to
happen." For example, it is possible to type:

<figure>
<pre>
<samp>es&gt; </samp><kbd>@ i {cd $i; rm -f *} /tmp</kbd>
</pre>
</figure>

<p>
directly at the shell, and this runs the inlined
function directly on the argument <code>/tmp</code>.

<p>
There is one more thing to notice: the inline function that was
supplied to <code>apply</code> had a parameter named <code>i</code>,
and the <code>apply</code> function itself used a reference to a
variable called <code>i</code>. Note that the two uses did not
conflict: that is because <i>es</i> function parameters are
<i>lexically scoped</i>, much as variables are in C and Scheme.

<h2><a id=variables>Variables</a></h2>

<p>
The similarity between shell functions and lambdas is not
accidental. In fact, function definitions are rewritten as assignments
of lambdas to shell variables. Thus these two <i>es</i> commands are
entirely equivalent:

<figure>
<pre>
<code>fn echon args {echo -n $args}
fn-echon = @ args {echo -n $args}</code>
</pre>
</figure>

<p>
In order not to conflict with regular variables, function variables
have the prefix <code>fn-</code> prepended to their names. This
mechanism is also used at execution time; when a name like
<code>apply</code> is seen by <i>es</i>, it first looks in its symbol
table for a variable by the name <code>fn-apply</code>.  Of course, it
is always possible to execute the contents of any variable by
dereferencing it explicitly with a dollar sign:

<figure>
<pre>
<samp>es&gt; </samp><kbd>silly-command = {echo hi}</kbd>
<samp>es&gt; </samp><kbd>$silly-command</kbd>
<samp>hi</samp>
</pre>
</figure>

<p>
The previous examples also show that variables
can be set to contain program fragments as well as
simple strings. In fact, the two can be intermixed:

<figure>
<pre>
es&gt; </samp><kbd>mixed = {ls} hello, {wc} world</kbd>
es&gt; </samp><kbd>echo $mixed(2) $mixed(4)</kbd>
<samp>hello, world</samp>
es&gt; </samp><kbd>$mixed(1) | $mixed(3)</kbd>
<samp>61 61 478</samp>
</pre>
</figure>

<p>
Variables can hold a list of commands, or even
a list of lambdas. This makes variables into versatile
tools. For example, a variable could be used as a
function dispatch table.

<h2><a id=binding>Binding</a></h2>

<p>
In the section on functions, we mentioned that function parameters are
lexically scoped. It is also possible to use lexically-scoped
variables directly.  For example, in order to avoid interfering with a
global instance of <code>i</code>, the following scoping syntax can be
used:

<figure>
<pre>
<code>let (<var>var</var> = <var>value</var>) {
  <var>commands which use $var</var>
}</code>
</pre>
</figure>

<p>
Lexical binding is useful in shell functions, where it becomes
important to have shell functions that do not clobber each others'
variables.

<p>
<i>Es</i> code fragments, whether used as arguments to commands or
stored in variables, capture the values of enclosing lexically scoped
values. For example,

<figure>
<pre>
<samp>es&gt; </samp><kbd>let (h=hello; w=world) {
  hi = { echo $h, $w }
}</kbd>
<samp>es&gt; </samp><kbd>$hi</kbd>
<samp>hello, world</samp>
</pre>
</figure>

<p>
One use of lexical binding is in redefining functions. A new
definition can store the previous definition in a lexically scoped
variable, so that it is only available to the new function. This
feature can be used to define a function for tracing calls to other
functions:

<figure>
<pre>
<code>fn trace functions {
  for (func = $functions)
    let (old = $(fn-$func))
    fn $func args {
      echo calling $func $args
      $old $args
    }
}</code>
</pre>
</figure>

<p>
The <code>trace</code> function redefines all the functions which are
named on its command line with a function that prints the function
name and arguments and then calls the previous definition, which is
captured in the lexically bound variable <code>old</code>. Consider a
recursive function <code>echo-nl</code> which prints its arguments,
one per line:

<figure>
<pre>
<samp>es&gt; </samp><kbd>fn echo-nl head tail {
  if {!~ $#head 0} {
    echo $head
    echo-nl $tail
  }
}</kbd>
<samp>es&gt; </samp><kbd>echo-nl a b c</kbd>
<samp>a
b
c</samp>
</pre>
</figure>

<p>
Applying <code>trace</code> to this function yields:

<figure>
<pre>
<samp>es&gt; </samp><kbd>trace echo-nl</kbd>
<samp>es&gt; </samp><kbd>echo-nl a b c</kbd>
<samp>calling echo-nl a b c
a
calling echo-nl b c
b
calling echo-nl c
c
calling echo-nl</samp>
</pre>
</figure>

<p>
The reader should note that

<figure>
<code>! <var>cmd</var></code>
</figure>

<p>
is <i>es</i>'s "not" command, which inverts the sense of the return
value of <var>cmd</var>, and

<figure>
<code>~ <var>subject</var> <var>pattern</var></code>
</figure>

<p>
matches <var>subject</var> against <var>pattern</var> and returns true if the
subject is the same as the pattern. (In fact, the matching is a bit
more sophisticated, for the pattern may include wildcards.)

<p>
Shells like the Bourne shell and <i>rc</i> support a form of local
assignment known as <em>dynamic binding</em>.  The shell syntax for
this is typically:

<figure>
<code><var>var</var>=<var>value</var> <var>command</var></code>
</figure>

<p>
That notation conflicts with <i>es</i>'s syntax for assignment (where
zero or more words are assigned to a variable), so dynamic binding has
the syntax:

<figure>
<pre>
<code>local (<var>var</var> = <var>value</var>) {
  <var>commands which use $var</var>
}</code>
</pre>
</figure>

<p>
The difference between the two forms of binding can be seen in an example:

<figure>
<pre>
<samp>es&gt; </samp><kbd>x = foo</kbd>
<samp>es&gt; </samp><kbd>let (x = bar) {
  echo $x
  fn lexical { echo $x }
}</kbd>
<samp>bar
es&gt; </samp><kbd>lexical</kbd>
<samp>bar
es&gt; </samp><kbd>local (x = baz) {
  echo $x
  fn dynamic { echo $x }
}</kbd>
<samp>baz
es&gt; </samp><kbd>dynamic</kbd>
<samp>foo</samp>
</pre>
</figure>

<h2><a id=settor-variables>Settor Variables</a></h2>

<p>
In addition to the prefix (<code>fn-</code>) for function execution
described earlier, <i>es</i> uses another prefix to search for
<i>settor variables</i>. A settor variable <code>set-</code><i>foo</i>
is a variable which gets evaluated every time the variable <i>foo</i>
changes value. A good example of settor variable use is the
<code>watch</code> function:

<figure>
<pre>
<code>fn watch vars {
  for (var = $vars) {
    set-$var = @ {
      echo old $var '=' $$var
      echo new $var '=' $*
      return $*
    }
  }
}</code>
</pre>
</figure>

<p>
<code>Watch</code> establishes a settor function for each of its
parameters; this settor prints the old and new values of the variable
to be set, like this:

<figure>
<pre>
<samp>es&gt; </samp><kbd>watch x</kbd>
<samp>es&gt; </samp><kbd>x=foo bar</kbd>
<samp>old x =
new x = foo bar
es&gt; </samp><kbd>x=fubar</kbd>
<samp>old x = foo bar
new x = fubar</samp>
</pre>
</figure>

<h2><a id=return-values>Return Values</a></h2>

<p>
UNIX programs exit with a single number between 0 and 255
reported as their statuses.  <i>Es</i> supplants the notion of an exit
status with "rich" return values. An <i>es</i> function can return
not only a number, but any object: a string, a program fragment, a
lambda, or a list which mixes such values.

<p>
The return value of a command is accessed by
prepending the command with <code>&lt;&gt;</code>:
[<a class=local href=#erratum2 name=erratum2-use>Errata note 2</a>]

<figure>
<pre>
<samp>es&gt; </samp><kbd>fn hello-world {
  return 'hello, world'
}</kbd>
<samp>es&gt; </samp><kbd>echo &lt;&gt;{hello-world}</kbd>
<samp>hello, world</samp>
</pre>
</figure>

<p>
This example shows rich return values being
used to implement hierarchical lists:

<figure>
<pre>
<code>fn cons a d {
  return @ f { $f $a $d }
}
fn car p { $p @ a d { return $a } }
fn cdr p { $p @ a d { return $d } }</code>
</pre>
</figure>

<p>
The first function, <code>cons</code>, returns a function which takes
as its argument another function to run on the parameters
<code>a</code> and <code>d</code>.  <code>car</code> and
<code>cdr</code> each invoke the kind of function returned by
<code>cons</code>, supplying as the argument a function which returns
the first or second parameter, respectively. For example:

<figure>
<pre>
<samp>es&gt; </samp><kbd>echo &lt;&gt;{car &lt;&gt;{cdr &lt;&gt;{
  cons 1 &lt;&gt;{cons 2 &lt;&gt;{cons 3 nil}}
}}}</kbd>
<samp>2</samp>
</pre>
</figure>

<h2><a id=exceptions>Exceptions</a></h2>

<p>
In addition to traditional control flow constructs -- loops,
conditionals, subroutines -- <i>es</i> has an exception mechanism
which is used for implementing non-structured control flow. The
built-in function <code>throw</code> raises an exception, which
typically consists of a string which names the exception and other
arguments which are specific to the named exception type. For example,
the exception <code>error</code> is caught by the default interpreter
loop, which treats the remaining arguments as an error message.
[<a class=local href=#erratum3 name=erratum3-use>Errata note 3</a>]
Thus:

<figure>
<pre>
<samp>es&gt; </samp><kbd>fn in dir cmd {
  if {~ $#dir 0} {
    throw error 'usage: in dir cmd'
  }
  fork # run in a subshell [<a class=local href="#erratum4" name="erratum4-use">Errata note 4</a>]
  cd $dir
  $cmd
}</kbd>
<samp>es&gt; </samp><kbd>in</kbd>
<samp>usage: in dir cmd
es&gt; </samp><kbd>in /tmp ls</kbd>
<samp>webster.socket yacc.312</samp>
</pre>
</figure>

<p>
By providing a routine which catches <code>error</code> exceptions, a
programmer can intercept internal shell errors before the message gets
printed.

<p>
Exceptions are also used to implement the <code>break</code> and
<code>return</code> control flow constructs, and to provide a way for
user code to interact with UNIX signals. While six error types
are known to the interpreter and have special meanings, any set of
arguments can be passed to <code>throw</code>.

<p>
Exceptions are trapped with the built-in <code>catch</code>, which
typically takes the form

<figure>
<pre>
<code>catch @ e args { <var>handler</var> } { <var>body</var> }</code>
</pre>
</figure>

<p>
<code>Catch</code> first executes <i>body</i>; if no exception is
raised, <code>catch</code> simply returns, passing along <i>body</i>'s
return value. On the other hand, if anything invoked by <i>body</i>
throws an exception, <i>handler</i> is run, with <code>e</code> bound
to the exception that caused the problem. For example, the last two
lines of <code>in</code> above can be replaced with:

<figure>
<pre>
<code>catch @ e msg {
  if {~ $e error} {
    echo &gt;[1=2] in $dir: $msg
  } {
    throw $e $msg
  }
} {
  cd $dir
  $cmd
}</code>
</pre>
</figure>

<p>
to better identify for a user where an error came from:

<figure>
<pre>
<samp>es&gt; </samp><kbd>in /temp ls</kbd>
<samp>in /temp: chdir /temp:
No such file or directory</samp>
</pre>
</figure>

<h2><a id=spoofing>Spoofing</a></h2>

<p>
<i>Es</i>'s versatile functions and variables are only half of the
story; the other part is that <i>es</i>'s shell syntax is just a front
for calls on built-in functions. For example:

<figure>
<pre>
<code>ls &gt; /tmp/foo</code>
</pre>
</figure>

<p>
is internally rewritten as

<figure>
<pre>
<code>%create 1 /tmp/foo {ls}</code>
</pre>
</figure>

<p>
before it is evaluated.  <code>%create</code> is the built-in function
which opens <code>/tmp/foo</code> on file-descriptor 1 and
runs<code>ls</code>.

<p>
The value of this rewriting is that the <code>%create</code> function
(and that of just about any other shell service) can be
<i>spoofed</i>, that is, overridden by the user: when a new
<code>%create</code> function is defined, the default action of
redirection is overridden.

<p>
Furthermore, <code>%create</code> is not really the built-in file
redirection service. It is a hook to the <i>primitive</i>
<code>$&amp;create</code>, which itself cannot be overridden.  That
means that it is always possible to access the underlying shell
service, even when its hook has been reassigned.

<p>
Keeping this in mind, here is a spoof of the redirection operator that
we have been discussing.  This spoof is simple: if the file to be
created exists (determined by running <code>test -f</code>), then the
command is not run, similar to the C-shell's "noclobber" option:

<figure>
<pre>
<code>fn %create fd file cmd {
  if {test -f $file} {
    throw error $file exists
  } {
    $&amp;create $fd $file $cmd
  }
}</code>
</pre>
</figure>

<p>
In fact, most redefinitions do not refer to the
<code>$&amp;</code>-forms explicitly, but capture references to them
with lexical scoping. Thus, the above redefinition would usually
appear as

<figure>
<pre>
<code>let (create = $fn-%create)
  fn %create fd file cmd {
    if {test -f $file} {
      throw error $file exists
    } {
      $create $fd $file $cmd
    }
  }</code>
</pre>
</figure>

<p>
The latter form is preferable because it allows multiple
redefinitions of a function; the former version
would always throw away any previous redefinitions.

<p>
Overriding traditional shell built-ins is another common example of
spoofing. For example, a <code>cd</code> operation which also places
the current directory in the title-bar of the window (via the
hypothetical command <code>title</code>) can be written as:

<figure>
<pre>
<code>let (cd = $fn-%cd)
fn cd {
  $cd $*
  title `{pwd}
}</code>
</pre>
</figure>

<p>
Spoofing can also be used for tasks which other shells cannot do; one
example is timing each element of a pipeline by spoofing
<code>%pipe</code>, along the lines of the pipeline profiler suggested
by Jon Bentley[<a class=local href=#ref7>7</a>]; see Figure 1.
[<a class=local href=#erratum5 name=erratum5-use>Errata note 5</a>]

<figure class=bigfig>
<pre>
<samp>es&gt; </samp><kbd>let (pipe = $fn-%pipe) {
  fn %pipe first out in rest {
    if {~ $#out 0} {
      time $first
    } {
      $pipe {time $first} $out $in {%pipe $rest}
    }
  }
}</kbd>
<samp>es&gt; </samp><kbd>cat paper9 | tr -cs a-zA-Z0-9 '\012' | sort | uniq -c | sort -nr | sed 6q</kbd>
<samp> 213 the
 150 a
 120 to
 115 of
 109 is
  96 and
   2r   0.3u   0.2s   cat paper9
   2r   0.3u   0.2s   tr -cs a-zA-Z0-9 \012
   2r   0.5u   0.2s   sort
   2r   0.4u   0.2s   uniq -c
   3r   0.2u   0.1s   sed 6q
   3r   0.6u   0.2s   sort -nr</samp>
</pre>
<figcaption>Figure 1: Timing pipeline elements</figcaption>
</figure>

<p>
Many shells provide some mechanism for caching the full pathnames of
executables which are looked up in a user's <code>$PATH</code>.
<i>Es</i> does not provide this functionality in the shell, but it can
easily be added by any user who wants it. The function
<code>%pathsearch</code> (see Figure 2) is invoked to lookup
non-absolute file names which are used as commands.

<figure class=bigfig>
<pre>
<code>let (search = $fn-%pathsearch) {
  fn %pathsearch prog {
    let (file = &lt;&gt;{$search $prog}) {
      if {~ $#file 1 &amp;&amp; ~ $file /*} {
        path-cache = $path-cache $prog
        fn-$prog = $file
      }
      return $file
    }
  }
}
fn recache {
  for (i = $path-cache)
    fn-$i =
  path-cache =
}</code>
</pre>
<figcaption>Figure 2: Path caching</figcaption>
</figure>

<p>
One other piece of <i>es</i> which can be replaced is the interpreter
loop. In fact, the default interpreter is written in <i>es</i> itself;
see Figure 3.

<figure class=bigfig>
<pre>
<code>fn %interactive-loop {
  let (result = 0) {
    catch @ e msg {
      if {~ $e eof} {
        return $result
      } {~ $e error} {
        echo &gt;[1=2] $msg
      } {
        echo &gt;[1=2] uncaught exception: $e $msg
      }
      throw retry
    } {
      while {} {
        %prompt
        let (cmd = &lt;&gt;{%parse $prompt}) {
          result = &lt;&gt;{$cmd}
        }
      }
    }
  }
}</code>
</pre>
<figcaption>Figure 3: Default interactive loop</figcaption>
</figure>

<p>
A few details from this example need further explanation. The
exception <code>retry</code> is intercepted by <code>catch</code> when
an exception handler is running, and causes the body of the
<code>catch</code> routine to be re-run.  <code>%parse</code> prints
its first argument to standard error, reads a command (potentially
more than one line long) from the current source of command input, and
throws the <code>eof</code> exception when the input source is
exhausted. The hook <code>%prompt</code> is provided for the user to
redefine, and by default does nothing.

<p>
Other spoofing functions which either have been suggested or are in
active use include: a version of <code>cd</code> which asks the user
whether to create a directory if it does not already exist; versions
of redirection and program execution which try spelling correction if
files are not found; a <code>%pipe</code> to run pipeline elements on
(different) remote machines to obtain parallel execution; automatic
loading of shell functions; and replacing the function which is used
for tilde expansion to support alternate definitions of home
directories. Moreover, for debugging purposes, one can use
<code>trace</code> on hook functions.

<h2><a id=implementation>Implementation</a></h2>

<p>
<i>Es</i> is implemented in about 8000 lines of C.  Although we
estimate that about 1000 lines are devoted to portability issues
between different versions of UNIX, there are also a number of
work-arounds that <i>es</i> must use in order to blend with
UNIX.  The <code>path</code> variable is a good example.

<p>
The <i>es</i> convention for path searching involves looking through
the list elements of a variable called <code>path</code>. This has the
advantage that all the usual list operations can be applied equally to
<code>path</code> as any other variable. However, UNIX
programs expect the path to be a colon-separated list stored in
<code>PATH</code>.  Hence <i>es</i> must maintain a copy of each
variable, with a change in one reflected as a change in the other.

<h2><a id=initialization>Initialization</a></h2>

<p>
Much of <i>es</i>'s initialization is actually done by an
<i>es</i> script, called <code>initial.es</code>, which is converted
by a shell script to a C character string at compile time and stored
internally. The script illustrates how the default actions for
<i>es</i>'s parser is set up, as well as features such as the
<code>path</code>/<code>PATH</code> aliasing mentioned above.
[<a class=local href=#erratum6 name=erratum6-use>Errata note 6</a>]

<p>
Much of the script consists of lines like:

<figure>
<pre>
<code>fn-%and = $&amp;and
fn-%append = $&amp;append
fn-%background = $&amp;background</code>
</pre>
</figure>

<p>
which bind the shell services such as short-circuit-and,
backgrounding, etc., to the <code>%</code>-prefixed hook variables.

<p>
There are also a set of assignments which bind
the built-in shell functions to their hook variables:

<figure>
<pre>
<code>fn-. = $&amp;dot
fn-break = $&amp;break
fn-catch = $&amp;catch</code>
</pre>
</figure>

<p>
The difference with these is that they are given names invoked
directly by the user; "<code>.</code>" is the Bourne-compatible
command for "sourcing" a file.

<p>
Finally, some settor functions are defined to work around UNIX
path searching (and other) conventions. For example,

<figure>
<pre>
<code>set-path = @ {
  local (set-PATH = )
    PATH = &lt;&gt;{%flatten : $*}
  return $*
}
set-PATH = @ {
  local (set-path = )
    path = &lt;&gt;{%fsplit : $*}
  return $*
}</code>
</pre>
</figure>

<p>
A note on implementation: these functions temporarily assign their
opposite-case settor cousin to null before making the assignment to
the opposite-case variable.  This avoids infinite recursion between
the two settor functions.

<h2><a id=the-environment>The Environment</a></h2>

<p>
UNIX shells typically maintain a table of variable definitions
which is passed on to child processes when they are created. This
table is loosely referred to as the environment or the environment
variables.  Although traditionally the environment has been used to
pass values of variables only, the duality of functions and variables
in <i>es</i> has made it possible to pass down function definitions to
subshells. (While <i>rc</i> also offered this functionality, it was
more of a kludge arising from the restriction that there was not a
separate space for "environment functions.")

<p>
Having functions in the environment brings them into the same
conceptual framework as variables -- they follow identical rules for
creation, deletion, presence in the environment, and so on.
Additionally, functions in the environment are an optimization for
file I/O and parsing time. Since nearly all shell state can now be
encoded in the environment, it becomes superfluous for a new instance
of <i>es</i>, such as one started by <i>xterm</i> (1), to run a
configuration file. Hence shell startup becomes very quick.

<p>
As a consequence of this support for the environment, a fair amount of
<i>es</i> must be devoted to "unparsing" function definitions so
that they may be passed as environment strings. This is complicated a
bit more because the lexical environment of a function definition must
be preserved at unparsing. This is best illustrated by an example:

<figure>
<pre>
<samp>es&gt; </samp><kbd>let (a=b) fn foo {echo $a}</kbd>
</pre>
</figure>

<p>
which lexically binds <code>b</code> to the variable <code>a</code>
for the scope of this function definition. Therefore, the external
representation of this function must make this information
explicit. It is encoded as:

<figure>
<pre>
<samp>es&gt; </samp><kbd>whatis foo</kbd>
<samp>%closure(a=b)@ * {echo $a}</samp>
</pre>
</figure>

<p>
(Note that for cultural compatibility with other shells, functions
with no named parameters use "<code>*</code>" for binding
arguments.)

<h2><a id=interactions-with-unix>Interactions With UNIX</a></h2>

<p>
Unlike most traditional shells, which have feature sets dictated by
the UNIX system call interface, <i>es</i> contains features
which do not interact well with UNIX itself. For example,
rich return values make sense from shell functions (which are run
inside the shell itself) but cannot be returned from shell scripts or
other external programs, because the <i>exit</i>/<i>wait</i> interface
only supports passing small integers. This has forced us to build some
things into the shell which otherwise could be external.

<p>
The exception mechanism has similar problems.  When an exception is
raised from a shell function, it propagates as expected; if raised
from a subshell, it cannot be propagated as one would like it to be:
instead, a message is printed on exit from the subshell and a false
exit status is returned. We consider this unfortunate, but there
seemed no reasonable way to tie exception propagation to any existing
UNIX mechanism. In particular, the signal machinery is
unsuited to the task. In fact, signals complicate the control flow in
the shell enough, and cause enough special cases throughout the shell,
so as to be more of a nuisance than a benefit.

<p>
One other unfortunate consequence of our shoehorning <i>es</i> onto
UNIX systems is the interaction between lexically scoped
variables, the environment, and subshells. Two functions, for example,
may have been defined in the same lexical scope. If one of them
modifies a lexically scoped variable, that change will affect the
variable as seen by the other function. On the other hand, if the
functions are run in a subshell, the connection between their lexical
scopes is lost as a consequence of them being exported in separate
environment strings. This does not turn out to be a significant
problem, but it does not seem intuitive to a programmer with a
background in functional languages.

<p>
One restriction on <i>es</i> that arose because it had to work in a
traditional UNIX environment is that lists are not
hierarchical; that is, lists may not contain lists as elements. In
order to be able to pass lists to external programs with the same
semantics as passing them to shell functions, we had to restrict lists
to the same structure as <i>exec</i>-style argument vectors.
Therefore all lists are flattened, as in <i>rc</i> and <i>csh</i>.

<h2><a id=garbage-collection>Garbage Collection</a></h2>

<p>
Since <i>es</i> incorporates a true lambda calculus, it includes the
ability to create true recursive structures, that is, objects which
include pointers to themselves, either directly or indirectly. While
this feature can be useful for programmers, it has the unfortunate
consequence of making memory management in <i>es</i> more complex than
that found in other shells. Simple memory reclamation strategies such
as arena style allocation <a class=local href="#ref8">[8]</a> or reference counting are unfortunately
inadequate; a full garbage collection system is required to plug all
memory leaks.

<p>
Based on our experience with <i>rc</i>'s memory use, we decided that a
copying garbage collector would be appropriate for <i>es</i>. The
observations leading to this conclusion were: (1) between two separate
commands little memory is preserved (it roughly corresponds to the
storage for environment variables); (2) command execution can consume
large amounts of memory for a short time, especially when loops are
involved; and, (3) however much memory is used, the working set of the
shell will typically be much smaller than the physical memory
available. Thus, we picked a strategy where we traded relatively fast
collection times for being somewhat wasteful in the amount of memory
used in exchange. While a generational garbage collector might have
made sense for the same reasons that we picked a copying collector, we
decided to avoid the added complexity implied by switching to the
generational model.

<p>
During normal execution of the shell, memory is acquired by
incrementing a pointer through a pre-allocated block. When this block
is exhausted, all live pointers from outside of garbage collector
memory, the <i>rootset</i>, are examined, and any structure that they
point to is copied to a new block. When the rootset has been scanned,
all the freshly copied data is scanned similarly, and the process is
repeated until all reachable data has been copied to the new block. At
this point, the memory request which triggered the collection should
be able to succeed. If not, a larger block is allocated and the
collection is redone.

<p>
During some parts of the shell's execution -- notably while the
<i>yacc</i> parser driver is running -- it is not possible to identify
all of the rootset, so garbage collection is disabled. If an
allocation request is made during this time for which there is not
enough memory available in the arena, a new chunk of memory is grabbed
so that allocation can continue.

<p>
Garbage collectors have developed a reputation for being hard to
debug. The collection routines themselves typically are not the source
of the difficulty. Even more sophisticated algorithms than the one
found in <i>es</i> are usually only a few hundred lines of
code. Rather, the most common form of GC bug is failing to identify
all elements of the rootset, since this is a rather open-ended problem
which has implications for almost every routine. To find this form of
bug, we used a modified version of the garbage collector which has two
key features: (1) a collection is initiated at every allocation when
the collector is not disabled, and (2) after a collection finishes,
access to all the memory from the old region is disabled.
[<a class=local href=#footnote3 name=footnote3-use>Footnote 3</a>]
Thus, any reference to a pointer in garbage collector space which
could be invalidated by a collection immediately causes a memory
protection fault. We strongly recommend this technique to anyone
implementing a copying garbage collector.

<p>
There are two performance implications of the garbage collector; the
first is that, occasionally, while the shell is running, all action
must stop while the collector is invoked. This takes roughly 4% of the
running time of the shell. More serious is that at the time of any
potential allocation, either the collector must be disabled, or all
pointers to structures in garbage collector memory must be identified,
effectively requiring them to be in memory at known addresses, which
defeats the registerization optimizations required for good
performance from modern architectures. It is hard to quantify the
performance consequences of this restriction.

<p>
The garbage collector consists of about 250 lines of code for the
collector itself (plus another 300 lines of debugging code), along
with numerous declarations that identify variables as being part of
the rootset and small (typically 5 line) procedures to allocate, copy,
and scan all the structure types allocated from collector space.

<h2><a id=future-work>Future Work</a></h2>

<p>
There are several places in <i>es</i> where one would expect to
be able to redefine the built-in behavior and no such hook exists. The
most notable of these is the wildcard expansion, which behaves
identically to that in traditional shells. We hope to expose some of
the remaining pieces of <i>es</i> in future versions.

<p>
One of the least satisfying pieces of <i>es</i> is its parser. We have
talked of the distinction between the core language and the full
language; in fact, the translation of <i>syntactic sugar</i> (i.e.,
the convenient UNIX shell syntax presented to the user) to core
language features is done in the same <i>yacc</i>-generated parser as
the recognition of the core language.  Unfortunately, this ties the
full language in to the core very tightly, and offers little room for
a user to extend the syntax of the shell.

<p>
We can imagine a system where the parser only recognizes the core
language, and a set of exposed transformation rules would map the
extended syntax which makes <i>es</i> feel like a shell, down to the
core language. The <i>extend-syntax</i> [<a class=local href=#ref9>9</a>] system
for Scheme provides a good example of how to design such a mechanism,
but it, like most other macro systems designed for Lisp-like
languages, does not mesh well with the free-form syntax that has
evolved for UNIX shells.

<p>
The current implementation of <i>es</i> has the undesirable
property that all function calls cause the C stack to nest. In
particular, tail calls consume stack space, something they could be
optimized not to do. Therefore, properly tail recursive functions,
such as <code>echo-nl</code> above, which a Scheme or ML programmer
would expect to be equivalent to looping, have hidden costs. This is
an implementation deficiency which we hope to remedy in the near
future.

<p>
<i>Es</i>, in addition to being a good language for shell programming,
is a good candidate for a use as an embeddable "scripting" language,
along the lines of Tcl.  <i>Es</i>, in fact, borrows much from Tcl --
most notably the idea of passing around blocks of code as unparsed
strings -- and, since the requirements on the two languages are
similar, it is not surprising that the syntaxes are so similar.
<i>Es</i> has two advantages over most embedded languages: (1) the
same code can be used by the shell or other programs, and many
functions could be identical; and (2) it supports a wide variety of
programming constructs, such as closures and exceptions. We are
currently working on a "library" version of <i>es</i> which could be
used stand-alone as a shell or linked in other programs, with or
without shell features such as wildcard expansion or pipes.

<h2><a id=conclusions>Conclusions</a></h2>

<p>
There are two central ideas behind <i>es</i>. The first is that
a system can be made more programmable by exposing its internals to
manipulation by the user.  By allowing spoofing of heretofore
unmodifiable shell features, <i>es</i> gives its users great
flexibility in tailoring their programming environment, in ways that
earlier shells would have supported only with modification of shell
source itself.

<p>
Second, <i>es</i> was designed to support a model of programming where
code fragments could be treated as just one more form of data. This
feature is often approximated in other shells by passing commands
around as strings, but this approach requires resorting to baroque
quoting rules, especially if the nesting of commands is several layers
deep. In <i>es</i>, once a construct is surrounded by braces, it can
be stored or passed to a program with no fear of mangling.

<p>
<i>Es</i> contains little that is completely new. It is a synthesis of
the attributes we admire most from two shells -- the venerable Bourne
shell and Tom Duff's <i>rc</i> -- and several programming languages,
notably Scheme and Tcl.  Where possible we tried to retain the
simplicity of <i>es</i>'s predecessors, and in several cases, such as
control flow constructs, we believe that we have simplified and
generalized what was found in earlier shells.

<p>
We do not believe that <i>es</i> is the ultimate shell.  It has a
cumbersome and non-extensible syntax, the support for traditional
shell notations forced some unfortunate design decisions, and some of
<i>es</i>'s features, such as exceptions and rich return values, do
not interact as well with UNIX as we would like them to. Nonetheless,
we think that <i>es</i> is successful as both a shell and a
programming language, and would miss its features and extensibility if
we were forced to revert to other shells.

<h2><a id=acknowledgements>Acknowledgements</a></h2>

<p>
We'd like to thank the many people who helped both with the
development of <i>es</i> and the writing of this paper. Dave Hitz
supplied essential advice on where to focus our efforts. Chris
Siebenmann maintained the <i>es</i> mailing list and ftp distribution
of the source. Donn Cave, Peter Ho, Noel Hunt, John Mackin, Bruce
Perens, Steven Rezsutek, Rich Salz, Scott Schwartz, Alan Watson, and
all other contributors to the list provided many suggestions, which
along with a ferocious willingness to experiment with a
not-ready-for-prime-time shell, were vital to <i>es</i>'s
development. Finally, Susan Karp and Beth Mitcham read many drafts of
this paper and put up with us while <i>es</i> was under development.

<h2><a id=footnotes>Footnotes</a></h2>

<p>
<a id=footnote1 class=local href=#footnote1-use>1.</a>

In our examples, we use "<code>es&gt;</code>" as <i>es</i>'s
prompt. The default prompt, which may be overridden, is
"<code>; </code>" which is interpreted by <i>es</i> as a null
command followed by a command separator. Thus, whole lines, including
prompts, can be cut and pasted back to the shell for re-execution. In
examples, an italic fixed width font indicates user input.</a>

<p>
<a id=footnote2 class=local href=#footnote2-use>2.</a>

The keyword <code>@</code> introduces the lambda. Since <code>@</code>
is not a special character in <i>es</i> it must be surrounded by white
space.  <code>@</code> is a poor substitute for the Greek letter
lambda, but it was one of the few characters left on a standard
keyboard which did not already have a special meaning.

<p>
<a id=footnote3 class=local href=#footnote3-use>3.</a>

This disabling depends on operating system support.

<h2><a id=errata>Errata</a></h2>

<p>
This section covers changes to <i>es</i> since original publication of
the paper.  If you are aware of any undocumented differences, please
contact the authors.

<p>
<a id=erratum1 class=local href=#erratum1-use>1.</a>

Haahr's present affiliation is
<a href="http://www.google.com/">Jive Technology</a>,
and he can be reached by email at
<a href="mailto:haahr@jivetech.com">haahr@jivetech.com</a>.

<p>
<a id=erratum2 class=local href=#erratum2-use>2.</a>

The <code>&lt;&gt;</code> operator for obtaining the return value of a
command has been renamed <code>&lt;=</code> to avoid conflicting with
the POSIX-compatible defintion of <code>&lt;&gt;</code> as "open for
reading and writing."

<p>
<a id=erratum3 class=local href=#erratum3-use>3.</a>

<code>error</code> exceptions now have an additional piece of
information.  The second word (the one after <code>error</code>) is
now the name of the routine which caused the error.  Thus, in the new
version of <code>in</code> below, the <code>throw</code> command has
an extra <code>in</code> in it.

<p>
<a id=erratum4 class=local href=#erratum4-use>4.</a>

This example users an obsolete version of the <code>fork</code>
builtin.  The <code>in</code> function should now be

<figure>
<pre>
<code>fn in dir cmd {
  if {~ $#dir 0} {
    throw error in 'usage: in dir cmd'
  }
  fork {    # run in a subshell
    cd $dir
    $cmd
  }
}</code>
</pre>
</figure>

<p>
<a id=erratum5 class=local href=#erratum5-use>5.</a>

The pipe timing example may not work on all systems.  It depends on
having a version of <code>time</code> that understands <i>es</i>,
either by building it in to <i>es</i> or having an external time use
the <code>SHELL</code> environment variable.  <i>Es</i> will include a
(minimal) time function if it is built with the compilation option
<code>BUITIN_TIME</code>.

<p>
<a id="erratum6" class=local href="#erratum6-use">6.</a>

The initialization procedure as originally described lead to
performance problems, for two reasons.  The first is the time needed
to parse and run the initialization code;  the second that the data
created by running the code (variable names and function definitions,
for example) had to be garbage collected.  <i>Es</i> solves both
problems by moving this work to compile-time.

<p>
When <i>es</i> is built, an executable called <code>esdump</code> is
created, which is a trimmed down version of the shell.  That program
is run, with the initialization file <code>initial.es</code> as its
input.  The last thing done in the initialization file is a call to a
primitive <code>$&amp;dump</code>, which is only included in
<code>esdump</code>, that writes out the entire memory state of the
shell as declarations in C source code.  The generated C code is
compiled and linked with the rest of the source to produce the real
shell executable.  The data from the dumping is not garbage collected
and is declared <code>const</code> so that the C compiler can put it
into read-only memory, if possible.

<h2><a id=references>References</a></h2>

<p>
<a id=ref1>1.</a>
Brian W. Kernighan and Rob Pike, <i>The UNIX Programming
Environment</i>, Prentice-Hall, 1984.

<p>
<a id=ref2>2.</a>
S. R. Bourne, "The UNIX Shell," <i>Bell Sys. Tech. J.</i>, vol. 57,
no. 6, pp. 1971-1990, 1978.

<p>
<a id=ref3>3.</a>
Tom Duff, "Rc -- A Shell for Plan 9 and UNIX Systems," in <i>UKUUG
Conference Proceedings</i>, pp. 21-33, Summer 1990.

<p>
<a id=ref4>4.</a>
William Clinger and Jonathan Rees (editors), <i>The Revised^4 Report
on the Algorithmic Language Scheme</i>, 1991.

<p>
<a id=ref5>5.</a>
Robin Milner, Mads Tofte, and Robert Harper, <i>The Definition of
Standard ML</i>, MIT Press, 1990.

<p>
<a id=ref6>6.</a>
John Ousterhout, "Tcl: An Embeddable Command Language," in <i>Usenix
Conference Proceedings</i>, pp. 133-146, Winter 1990.

<p>
<a id=ref7>7.</a>
Jon L. Bentley, <i>More Programming Pearls</i>, Addison-Welsey, 1988.

<p>
<a id=ref8>8.</a>
David R. Hanson, "Fast allocation and deallocation of memory based on
object lifetimes," <i>Software -- Practice and Experience</i>,
vol. 20, no.  1, pp. 5-12, January, 1990.

<p>
<a id=ref9>9.</a>
R. Kent Dybvig, <i>The Scheme Programming Language</i>, Prentice-Hall,
1987.

<h2><a id=author-information>Author Information</a></h2>

<p>
Paul Haahr is a computer scientist at Adobe Systems Incorporated where
he works on font rendering technology. His interests include
programming languages, window systems, and computer architecture. Paul
received an A.B. in computer science from Princeton University in
1990. He can be reached by electronic mail at <i>haahr@adobe.com</i>
or by surface mail at Adobe Systems Incorporated, 1585 Charleston
Road, Mountain View, CA 94039.  [<a class=local href=#erratum1>Errata note 1</a>]

<p>
Byron Rakitzis is a system programmer at Network Appliance
Corporation, where he works on the design and implementation of their
network file server. In his spare time he works on shells and window
systems.  His free-software contributions include a UNIX
version of <i>rc</i>, the Plan 9 shell, and <i>pico</i>, a version of
Gerard Holzmann's picture editor <i>popi</i> with code generators for
SPARC and MIPS. He received an A.B. in Physics from Princeton
University in 1990.  He has two cats, Pooh-Bah and Goldilocks, who try
to rule his home life. Byron can be reached at
<a href="http://www.rakitzis.com/resume.html">byron@netapp.com</a>
or at
<a href="http://www.netapp.com/">Network Appliance Corporation</a>,
2901 Tasman Drive, Suite 208, Santa Clara, CA 95054.
