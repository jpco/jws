<; cat tmpl/header.html >

<title>jpco.io | Programmable completion and shell design</title>
<meta name=description content="This page discusses how programmable completion reflects the design of the shell in which it is implemented, and what that implies for tab completion in the extensible shell es.">

<; build-nav >

<main>
<h1>Programmable completion and shell design</h1>
<div class=time><time datetime=REPLACEME>REPLACEME</time></div>

<p>
I have been thinking about programmable tab completion designs in shells lately, and something that I have slowly come to notice is the degree to which tab completion schemes reflect the design of their shell.

<p>
This is a consequence of a few factors.
For one thing, completion is complicated; it can&rsquo;t be wrapped up in a simple set of options.
Completion scripts for random commands such as <code>lsof(8)</code> require dozens of lines to configure.
Moreover, there is essentially no compatibility between shells, which is obnoxious, but it does allow each shell&rsquo;s system to be unique and optimized directly to the shell.


<h2>Different completion systems</h2>

<p>
We can use the <a href=/notcat>notcat</a> CLI to illustrate completion systems.
Notcat is a slightly complicated CLI, but not nearly as overwhelmingly so as something like <code>git</code>.

<h3>bash</h3>

<h3>tcsh</h3>

<h3>zsh</h3>

<h3>fish</h3>

<p>
Fish should be considered a shell that performs tab completion especially well.
While we likely won&rsquo;t take too much from <em>how</em> it does completion, we should strongly consider <em>what</em> completion behaviors it can do, because having some method to perform the same behaviors is likely to be reasonably &ldquo;complete&rdquo;.

<p>
<code>complete</code> does all the work.
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
Fish has really good support in general for flags (a.k.a., named arguments), and exploits that support effectively.
In some cases (confirm this), fish is able to do via named arguments what bash does via environment variables.
Named arguments seem like a better mechanism&mdash;consider this.
(Though, if we have named arguments, should we also have named return values?)


<h3>elvish</h3>

<h2>What does this mean for <i>es</i>?</h2>

<p>
Be opt-in and unobtrusive.
Some people don&rsquo;t want tab completion.

<p>
Prefer to exploit hook functions, lexical state, and first-class functions.  Avoid piles of settings, dynamic state, and tweaks to global tables.

<p>
Aim to implement as much as possible in <i>es</i>, rather than C.
This helps with functions that call functions (i.e., completions can call completions)&mdash;even with a fish-like mechanism, recursive completions would be necessary by <em>some</em> method.
Doing things in <i>es</i> also helps reduce the complexity of the C layer, which helps with both implementation difficulty as well as the next point.

<p>
Try, ideally, to be editor-library-agnostic.
In particular, don&rsquo;t adjust down to what readline can do; be capable of better things than that.

<p>
Parser support&hellip;
