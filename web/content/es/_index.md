---
title: es
description: The extensible shell
---

*Es* is the extensible shell.

It was originally developed by Bryan Rakitzis and Paul Haahr in the early '90s.

For a proper, formal introduction to the language as it was at the time, see [the paper](paper.html) presented at Usenix 1993.  The current "canonical" source, maintained by James Haggerty, is available on [Github](https://github.com/wryun/es-shell), as is [my fork](https://github.com/jpco/es-shell), which is undergoing slow, but ongoing development.

These pages are intended to provide a source of useful information for someone potentially interested in hacking on or simply using *es*.

## A Short Introduction to the Extensible Shell

In very simple cases, *es* looks similar to most other Unix shells:

```
message='Hello, world!'
echo $message | tee my-first-output.txt
```

In more complex cases, *es* looks like a strange mix of the Plan 9 shell *rc*, Tcl, and Scheme.  It also shares those languages' core design philosophy: building a useful, flexible language out of a small number of powerful core mechanisms.

Additionally, *es* shares with Tcl and Scheme the notion that code and data are largely interchangeable[^1].

At its core, *es* is built of commands, which are whitespace-separated lists of terms (i.e., strings).  This is like other shell languages.  For instance, what in bash looks like

```
function do-3-times {
  $*; $*; $*
}
do-3-times echo 'Hello, world!'
```

looks very similar in *es*:

```
fn do-3-times cmd {
  $cmd; $cmd; $cmd
}
do-3-times echo 'Hello, world!'
```

and both snippets here have the same effect.

However, things get more difficult in bash (and other POSIX-compatible shells) when the command passed into `do-3-times` gets more complicated.  For instance, what do you do when you want to `do-3-times` a sequence of two commands[^2]?  In *es*, it's simple and obvious.

```
do-3-times {echo 'Hello, world!'; echo 'How are you?'}
```

---

Variables in *es* are, by default, flat lists, explicitly mirroring the data type of arguments to commands in Unix.  This avoids quite a bit of angst:

```
files = 'Take on Me.mp3' 'Never Gonna Give You Up.flac'
touch $files
# Both 'Take on Me.mp3' and 'Never Gonna Give You Up.flac' now exist

for (file = $files) {
  rm $file
}
# Now neither file exists.
```

This is the obvious, idiomatic, and mostly[^3] correct way to do this in *es*.

Many shells are under-equipped to handle this scenario.  POSIX-compliant shells store (either exclusively or by default) variable values as strings, and try to split them in a sensible way upon use, which can lead to all sorts of trouble [if extreme care isn't taken](https://mywiki.wooledge.org/BashFAQ/050).  *Es*, following *rc*, takes the somewhat simpler approach of splitting values when initally read, and then never again unless explicitly asked (via, for example, the `%split` or `%fsplit` functions).

*Es* variables also inherit from *rc* simple list-handling constructs: subscripting (`$list(3)` as well as ranges like `$list(2 ... 4)` pull sublists of `$list`), concatenation (`(a b)^(c d)` produces `ac ad bc bd`), counting (`$#list` returns the length of `$list`), and flattening (`$^list` turns a list to a string).

Code blocks (seen, briefly, previously) are single elements in *es* lists.

```
fn interleave first second third {
  $first; $second
  $first; $third
  $second; $third
}

commands = {echo ONE} {echo TWO} {echo THREE}
echo $#commands
# 3

interleave $commands
# ONE TWO
# ONE THREE
# TWO THREE
```

This is how, for example, the `if` function works: it takes a list of arguments, runs the first one, and then, if the first argument exits "truthily", runs the second argument (and given more arguments, continues in an "else-if-else" fashion).

```
fn true {
  result 0
}

fn affirm {
  echo 'You got it!'
}

if true affirm
# You got it!
```

This is the same as:

```
if {result 0} {
  echo 'You got it!'
}
```

which should actually look somewhat like syntax.  Most language constructs in *es* are built like this, and it's (relatively) easy to build even more (this is part of the "extensible" in "the extensible shell").

---

*Es* also implements a lambda calculus, including lexical binding.  If code blocks alone don't do enough, lambda literals can be defined with named parameters ready to be bound:

```
@ e1 e2 e3 {echo $e3 $e2 $e1} first second third
# third second first
```

Lambdas are no different from any function --- they take arguments, you can `return` from them, and you can save them and run them multiple times.  In fact, function declaration in *es* is implemented as assigning lambdas to variables.  Lambdas simply provide a way to pass functions around in variables, or as arguments to other functions.  This means that, for instance, anywhere someone would use

```
fn foo str {
  echo FOO $str
}

fn apply-thrice cmd {
  $cmd ONE
  $cmd TWO
  $cmd THREE
}

apply-thrice foo
# FOO ONE
# FOO TWO
# FOO THREE
```

one can also immediately say

```
apply-thrice @ msg {echo FROM LAMBDA $msg}
# FROM LAMBDA ONE
# FROM LAMBDA TWO
# FROM LAMBDA THREE
```

Because *es* has lexical binding, too, the following is possible:

```
fn enclose-with outer {
  apply-thrice @ msg {echo FROM CLOSURE $outer -- $msg}
}

enclose-with ALPHA
# FROM CLOSURE ALPHA -- ONE
# FROM CLOSURE ALPHA -- TWO
# FROM CLOSURE ALPHA -- THREE
enclose-with BETA
# FROM CLOSURE BETA -- ONE
# FROM CLOSURE BETA -- TWO
# FROM CLOSURE BETA -- THREE
```

Having lexical binding and a lambda calculus in the language unlocks some powerful stuff, and allows *es* to piggy-back off of the work and constructs of previous lambda-focused languages, like Scheme.

This page doesn't address all of the interesting features of *es*, such as its rich return values, exception mechanism, and syntax rewriting --- check out the [paper](paper.html) by the original authors for a complete introduction.  For snippets of the language in action, look at the [useful snippets](useful.html) collection or some of the [es source](https://github.com/jpco/es-shell/tree/master/builtin) itself.


[^1]: Scheme is obviously [homoiconic](https://en.wikipedia.org/wiki/Homoiconicity), being a Lisp.  Tcl is less obviously homoiconic, but because it is also based on a core data type (the string), which its code is easily represented as, and it focuses on metaprogramming as a core part of the language, it definitely counts for this purpose.

[^2]: Seriously, let me know.  I spent some time trying to get this right, but couldn't figure it out.  For a very simple case, try just getting `echo OK; echo YUCK` to execute thrice without naming any functions other than `do-3-times` (the definition of `do-3-times` itself may be changed --- there's probably some quoting that I failed to get right somewhere).

[^3]: If the first element of `files` is a flag, then the commands *es* runs will do The Wrong Thing.  But I don't know of any shell language that solves that problem.  I believe it's a design flaw of the Unix shell paradigm itself.
