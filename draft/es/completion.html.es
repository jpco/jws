<; cat tmpl/header.html >

<title>jpco.io | Programmable completion and shell design</title>
<meta name=description content="This page discusses how programmable completion reflects the design of the shell in which it is implemented, and what that implies for tab completion in the extensible shell es.">

<; build-nav >

<main>
<h1>Programmable completion and shell design</h1>
<div class=time><time datetime=REPLACEME>REPLACEME</time></div>

<p>
I have been thinking about programmable tab completion designs in shells lately, and something that I have come to notice is the degree to which a shell&rsquo;s tab completion scheme reflects its overall design.

<p>
This is a consequence of a few factors.
For one thing, completion is complicated; it can&rsquo;t be wrapped up in a simple set of options.
Completion scripts for random commands such as <code>lsof(8)</code> require dozens of lines to configure.
Moreover, there is essentially no compatibility between shells, which is obnoxious, but it does allow each shell&rsquo;s system to be unique and optimized directly to the shell.


<h2>Different completion systems</h2>

<p>
There are a few things to look at with each shell&rsquo;s completion system.
How is a command (in particular, a complex one with variables, quoted terms, redirecitons, pipes, and so on) presented to completion logic?
How does the completion logic solve what I call &ldquo;the cdpath problem&rdquo;, where a completion term referring to essentially a random directory must be presented correctly?

<h3>bash</h3>

<p>
Bash (<a href="https://www.gnu.org/savannah-checkouts/gnu/bash/manual/bash.html#Programmable-Completion">whose online documentation is quite informative</a>) uses the <code>complete</code> builtin to specify how certain commands or prefixes are to be completed.
There are built-in completions that can be performed (<code>complete -f</code>) and multiple ways to specify functions or commands to be called: <code>complete -F</code> (supposedly, for &ldquo;function&rdquo;), <code>complete -C</code> (&ldquo;command&rdquo;), and <code>complete -X</code> (&ldquo;exclude&rdquo;).
The <code>-F</code> convention seems to be the preferred one by far (commands invoked via <code>-C</code> are done in a subshell with their output being captured like in a command substitution; presumably, this leads to the usual rescanning issues.)

<p>
The input to one of these functions is in the form of a few special variables:

<ul>
<li><code>COMP_LINE</code>: current command being completed (not including other commands in the pipeline, or other commands separated by <code>&amp;</code> or <code>;</code>, but including unprocessed variables, command substitutions, and redirections&mdash;even quotes are not removed)
<li><code>COMP_POINT</code>: the character index within the line at which completion is taking place
<li><code>COMP_KEY</code>: the key used to invoke the completion function&mdash;potentially useful when completion keybindings are themselves programmable
<li><code>COMP_TYPE</code>: the type of completion (in the readline sense), one of <code>'%'</code>, <code>'?'</code>, <code>TAB</code>, and so on; what these actually mean doesn&rsquo;t matter for this page
</ul>

<p>
The list of possible completions is placed in the <code>COMPREPLY</code> array variable, or printed to stdout in case of a command invoked via <code>complete -C</code>.
(There are actually two more variables besides, <code>COMP_WORDS</code> and <code>COMP_WORDBREAKS</code>; see the documentation.)

<p>
It is reasonably common to use <code>complete -F</code> to define a completion function for a command, and then from that function call <code>compgen</code> to perform certain kinds of built-in completions, like filename, directory, or even just a hardcoded list of words.
Both the <code>compgen</code> and <code>compopt</code> builtins perform, immediately, aspects of what the <code>complete</code> builtin configures ahead of time to be done for a certain completion.

<p>
It is also fairly common for <a href="https://github.com/scop/bash-completion/">completions in the bash-completion package</a> to use a helper function like <code>_comp_initialize</code> to pre-process the input variables into a simpler, more commonly useful shape.
This command populates the dynamically-scoped variables <code>cur</code>, <code>prev</code>, <code>words</code>, <code>cword</code>, and <code>was_split</code> with the current word, previous word, an array containing all the words, the current word&rsquo;s index in the array, and a variable indicating whether the current &ldquo;word&rdquo; is actually the part of a GNU longopt-style <code>--foo=bar</code> flag after the equal sign.
<code>_comp_initialize</code> also strips out any redirections in the command.
Notably, this function doesn&rsquo;t expand variables or dequote terms.

<p>
Post-completion behaviors like sorting, filtering, and completion type designation are achieved with a mix of completion options via <code>complete -o</code> or <code>compopt</code>, and the <code>FIGNORE</code> variable.
The cdpath problem is &ldquo;solved&rdquo; using the <code>nospace</code> completion option and manually adding <code>/</code> to completion candidates in the <code>cd</code> completion function.
(This is why cdpath completion in bash doesn&rsquo;t color the cdpath directories when the <code>colored-stats</code> readline option is enabled; readline doesn&rsquo;t even know that those entries are directories.)

<p>
This setup, especially the heavy use of special variables and the special option space, reflects the lack of power of arguments and return values in bash (as inherited from <code>sh</code>) and a preference for open-ended communication mechanisms in order to support backwards compatibility.


<h3>tcsh</h3>

<p>
<a href="https://www.ibm.com/docs/en/zos/3.2.0?topic=shell-complete-built-in-command-tcsh-list-completions">Tcsh has its own <code>complete</code> builtin</a>, which is <a href="https://github.com/tcsh-org/tcsh/blob/master/complete.tcsh">rather different than that of other shells</a>.

<p>
This <code>complete</code> takes a vaguely <code>ed(1)</code>-command-like string which configures an internal completion table, like:

<figure>
<pre>
<code>complete cd 'p/1/d/'</code>
</pre>
</figure>

<p>
The <code>p/1</code> here specifies that this is a <em>position</em>-dependent completion for the first argument of <code>cd</code>.
The <code>d</code> specifies that the candidates for completion are directories.

<p>
There are alternatives to these: instead of position-dependent completion, completion can be based on something about the current word (specified via glob pattern), or the previous word (also via glob pattern).
Instead of directories, completions can be aliases, environment variables, filenames, groups, jobs, limits, shell variables, signals, usernames, a custom list, or even a command to run.
Multiple of these can be provided for a single command for more complex cases.  For example, as documented:

<figure>
<pre>
<code>complete find \
	'n/-name/f/' 'n/-newer/f/' 'n/-{,n}cpio/f/' \
	'n/-exec/c/' 'n/-ok/c/' 'n/-user/u/' \
	'n/-group/g/' 'n/-fstype/(nfs 4.2)/' \
	'n/-type/(b c d f l p s)/' \
	'c/-/(name newer cpio ncpio exec ok user \
	group fstype type atime ctime depth inum \
	ls mtime nogroup nouser perm print prune \
	size xdev)/' \
	'p/*/d/'</code>
</pre>
</figure>

<p>
This is very csh-ish in all the ways that <i>es</i> avoids, design-wise.
It lets users easily and very concisely define a simple, half-correct completion for a command, but it does so by performing a lot of internal hard-coded logic, including parsing a specialized DSL.

<p>
Despite the oddities that make this setup a poor choice for <i>es</i> to emulate, <a href="https://github.com/marckhouzam/tcsh-completion">it <em>can</em> be used to call out to bash completions</a>, which is something <i>es</i> would also benefit from, given the massive size of bash&rsquo;s completion library and the lack of spare <i>es</i> developer-hours.


<h3>zsh</h3>

<p>zsh is intimidating.</p>

<h3>fish</h3>

<p>
Fish should be considered a shell that performs tab completion especially well.
While we likely won&rsquo;t take too much from <em>how</em> it does completion, we should strongly consider <em>what</em> completion behaviors it can do, because having some method to perform the same behaviors is likely to be reasonably &ldquo;complete&rdquo;.

<p>
<a href="https://fishshell.com/docs/current/completions.html">Its <code>complete</code> command does all the work</a>.
Any single given command will have <code>complete</code> called for it several times to configure its completions.

<p>
For example, the completion setup for <code>make</code> looks like this:

<figure>
<pre>
<code>complete -c make -n 'commandline -ct | string match -q "*=*"' -a "(__fish_complete_make_targets (commandline -p))" -d Target
complete -f -c make -n 'commandline -ct | not string match -q "*=*"' -a "(__fish_complete_make_targets (commandline -p))" -d Target
complete -c make -s f -d "Use file as makefile" -r
complete -x -c make -s C -l directory -x -a "(__fish_complete_directories (commandline -ct))" -d "Change directory"
complete -c make -s d -d "Debug mode"
complete -c make -s e -d "Environment before makefile"
complete -c make -s i -d "Ignore errors"
complete -x -c make -s I -d "Search directory for makefile" -a "(__fish_complete_directories (commandline -ct))"
complete -f -c make -s j -d "Number of concurrent jobs (no argument means no limit)"
complete -c make -s k -d "Continue after an error"
complete -c make -s l -d "Start when load drops"
complete -c make -s n -d "Do not execute commands"
complete -c make -s o -r -d "Ignore specified file"
complete -c make -s p -d "Print database"
complete -c make -s q -d "Question mode"
complete -c make -s r -d "Eliminate implicit rules"
complete -c make -s s -d "Quiet mode"
complete -c make -s S -d "Don't continue after an error"
complete -c make -s t -d "Touch files, don't run commands"
complete -c make -s v -d "Display version and exit"
complete -c make -s w -d "Print working directory"
complete -c make -s W -r -d "Pretend file is modified"</code>
</pre>
</figure>

<p>
The first two commands configure the completion to work on makefile targets (using a here-undocumented custom function <code>__fish_complete_make_targets</code>) rather than the usual default filename completion.

<p>
Most of the remaining commands (the ones using <code>-s</code>) are simply defining and describing (using <code>-d</code>) different flags used when running <code>make</code>.
One flag, <code>-C</code>, has a long version, configured here with <code>-l directory</code>.
<code>-C</code>, along with <code>-I</code>, also takes a directory as its argument, seen with the <code>-a</code> flag here.

<p>
The <code>commandline</code> builtin is used in a couple places here to look up pieces of the command: <code>commandline -ct</code> returns the current token (that is, the current uncompleted word), while <code>commandline -p</code> returns the current command including a current candidate completion.
In other contexts, <code>commandline</code> can also be used to change the edit buffer.

<p>
There seems to be some nice small design in terms of working with directories&hellip;
how does fish get good directory ergonomics without something like <code>%completion-to-file</code>?
Is it just checking for a terminating slash?

<p>
Fish also uses this setup to produce <em>hints</em>, in addition to completions.

<p>
In general, fish has really good support for flags (a.k.a., named arguments), and exploits that support effectively.
In some cases (confirm this), fish is able to do via named arguments what bash does via environment variables.
Named arguments seem like a better mechanism&mdash;consider this.
(This may be something best achieved for <i>es</i> via first-class environments.)


<h3>elvish</h3>

<p>Elvish is weird.</p>

<h2>What does this mean for <i>es</i>?</h2>

<p>
<i>Es</i> is minimal by default.
Completion should be opt-in, and unobtrusive when not opted into&mdash;for example, the function namespace shouldn&rsquo;t be polluted by a pile of unused completion hooks.

<p>
<i>Es</i> is built around function and code-fragment invocation, with lexical arguments and rich return values.
Make use of these wherever possible; try to exploit the fact that what make up many features in other shells are flattened in <i>es</i> into function calls.

<p>
Much of <i>es</i> is implemented in <i>es</i>, and can be changed with <i>es</i> script.
In order to have completion logic capable of the same flexibility as evaluation logic, a correspondingly large amount of completion should be implemented in <i>es</i> as well.
Doing things in <i>es</i> also helps reduce the complexity of the C layer, which helps with implementation difficulty.

<p>
It should be reasonably easy (and legible) to spoof a completion hook for a function in the same file that the function itself is spoofed (for example, the cdpath canonical extension script should ideally also spoof the completion hook for cd).
This implies that the definition of a completion hook should be possible to look up without needing to invoke the hook; something to note for a potential autoloading facility.

<p>
Completing a syntactically sugary command like

<figure>
<pre>
<code>first-cmd |[1=2] second-cmd &gt; file [TAB]</code>
</pre>
</figure>

<p>
should, like evaluating the command, be implemented using function calls: the completion hook for <code>%pipe</code> should be called, and it should recurse to the hook for <code>%create</code> (the function which implements the <code>&gt;</code> redirection), which should try to dispatch to a completion hook for <code>second-cmd</code>, if it exists.
To some degree, this is made obligatory by the existence of spoofable syntax hooks.
Given the meaning of syntax can change arbitrarily, the way that syntax is completed should also have that ability.
Moreover, though, <i>es</i> is never more powerful than it is when working with functions and code fragments.

<p>
However, doing the above requires making sense of an incomplete, potentially syntactically invalid command, and analyzing program fragments in a way that would be novel for the shell, which has historically treated anything in a <code>{}</code> as a single, indivisible unit.
The desire for orthogonality in <i>es</i> would suggest that readline&rsquo;s built-in completion should be separate from these other novel behaviors, and they should be tied together using <i>es</i> script.

<p>
The cdpath problem should be solved&hellip; how?
Well, the cdpath problem is really a special case of a more general problem: providing metadata for completion candidates.
Solving the cdpath problem is really about providing a bit of metadata (a filename) corresponding with a completion candidate, but other metadata has already been listed here: for example, fish&rsquo;s completion descriptions are another type of metadata associated with completion candidates.

<p>
This metadata is generally fairly complex (see elvish, TODO); <i>es</i> is not great at working with complex data, but it is good at defining and passing around functions.
This implies that managing hook functions is probably the ideal way to support these forms of metadata in <i>es</i>, especially given the metadata also needs to be spoofable (consider <code>in</code> and its <code>%completion-to-file</code>).

<h2>Implementation</h2>

<p>
How do we teach the parser to work with incomplete commands?
<a href="https://blog.jez.io/error-recovery-part-4/">This blog post</a> is the first evidence I&rsquo;ve seen that suggests that yacc error recovery might be powerful enough to do it, but more study is necessary.
Fortunately, incomplete commands are a strict subset of invalid syntax, so <a href="https://tratt.net/laurie/blog/2020/automatic_syntax_error_recovery.html">a completely general error-recovery strategy</a> isn&rsquo;t necessary.

<p>
How do we recurse?  Consider what the <code>in</code> completion hook will need to do in these examples:

<figure>
<pre>
<code>in /tmp echo file[TAB]
in /tmp {echo file[TAB]
in /tmp {var = &lt;={result file[TAB]</code>
</figure>

<p>
Correctly performing completion on built-in behavior like assignment will require built-in completion logic.
Recursing to built-in completion from in-<i>es</i> completion will require a primitive.

<p>
How do we expose variables and other syntax transformed by glomming to completion hooks?
Variable completion should be built-in (since variable resolution is built-in), and completion of a command like <code>cmd &lt;={echo [TAB]</code> is okay to only care about the <code>echo [TAB]</code>, since it is called <em>before</em> the outer <code>cmd</code> can affect it in any way.  But&hellip; how do we expose a term like a variable or function call when completing a command?  Surely we don&rsquo;t want

<figure>
<pre>
<code>in &lt;={sleep 100 &amp;&amp; result .} echo hello[TAB]</code>
</pre>
</figure>

<p>
to hang the shell for 100 seconds, do we?
It&rsquo;s easy to imagine much worse scenarios involving <code>rm</code>.
Is this rare enough not to worry about?
The alternative would be to do some kind of complicated partial-glomming, where the parsed outer command would be converted to a list without actually performing the call, and then the completion hook would have imperfect information about the command.
(This is also directly relevant to redirection completion, given the use of the <code>%one</code> function in most of the desugaring of redirections.)

<p>
All of these above questions are related to parsing and recursing through commands undergoing completion, and those (as has already been stated) should be separate and orthogonal from the actual completion code itself.
So how should the completion code look in order to be compatible with those mechanisms?

<p>
Readline should expose complete, raw information to the top-level completion hook.
With this, the hook can perform additional sophistication, such as &ldquo;cooking&rdquo; the information it is given into something through which it can properly recurse.
Initially, the logic to cook the command line is likely to be relatively simple (e.g., &ldquo;just give me the current command between pipe characters and semicolons, split on arguments, and remove any redirections&rdquo;), and can be swapped out for something more sophisticated later.

<p>
Fortunately, most commands in a completion &ldquo;library&rdquo; are simple Unix binaries which accept regular string as arguments, rather than other, nested <i>es</i> commands.
These completion hooks probably won&rsquo;t require much change at all as the internal <i>es</i> functionality becomes more capable.
They would just have less and less flaky input over time.

</main>
