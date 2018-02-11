---
title: es
description: The extensible shell
---

*Es* is the extensible shell.

For a proper, formal introduction to the language, see [the Usenix paper](paper.html).  The "canonical" source code is available on [Github](https://github.com/wryun/es-shell), as is [my fork](https://github.com/jpco/es-shell), which is undergoing ongoing development[^1].

These pages are intended to provide a source of useful information for someone potentially interested in hacking on or simply using *es*.

## A Short(-ish) Introduction to the Extensible Shell

In very simple cases, *es* looks similar to most other shells:

```
message='Hello, world!'
echo $message | tee my-first-output.txt
```

In more complex cases, *es* looks like a strange mix of *rc* (the Plan 9 command interpreter), Tcl, and Scheme.  (You know, those universally popular and widely embraced languages...)

Fundamentally, *es* is built around a simple conceit: Code and data are really the same thing[^2]: lists of strings.  At its core, shell "code" is built out of commands, which are whitespace-separated lists of words.  Because of the loosey-goosey nature of shell semantics, when variables are used as arguments to a command (or as the command word itself), it might be considered that the variables store *code*.

```
fn do-3-times func arg {
  $func $arg
  $func $arg
  $func $arg
}

do-3-times echo 'Hello, world!'
# Hello, world!
# Hello, world!
# Hello, world!
```

Many shells are under-equipped to handle this.  POSIX-compliant shells store (either exclusively or by default) variable values as strings, and try to split them in a sensible way upon use, which can lead to all sorts of trouble [if extreme care isn't taken](https://mywiki.wooledge.org/BashFAQ/050).  *Es*, following *rc*, takes a somewhat simpler approach --- all variables store *lists* of strings, which are split when they're initially read, and then never again (unless explicitly commanded to).  This makes constructs simple in *es* which take surprising care in other shells:

```
files = 'Take on Me.mp3' 'Never Gonna Give You Up.flac'
for (file = $files) {
  rm $file
}
```

This is the obvious, idiomatic, and mostly-correct way to do this in *es* ("mostly" in that there's going to be a problem if any of your files happen to be something like `-r`, but that's another animal that I don't *think* is solvable by any shell syntax).

*Es* variables also inherit from *rc* simple list-handling constructs: subscripting (`$list(3)` as well as ranges like `$list(2 ... 4)` pull sublists of `$list`), concatenation (`(a b)^(c d)` produces `ac ad bc bd`), and flattening (`$^list` turns a list to a string).

Because of the listiness of variables, in the previous `do-3-times` example, we don't need to give the `do-3-times` function two parameters.  In the following code, the two arguments `echo` and `Hello, world!` both get assigned to the value of the `cmd` parameter.

```
fn do-3-times cmd {
  $cmd
  $cmd
  $cmd
}

do-3-times echo 'Hello, world!'
# Hello, world!
# Hello, world!
# Hello, world!
```

However, *es* leans in even further to the "code-as-data" conceit, by providing code blocks as a type of "word":

```
fn interleave cmd1 cmd2 {
  $cmd1
  $cmd2
  $cmd1
  $cmd2
}

interleave {echo 'One!'} {echo 'Two!'}
# One!
# Two!
# One!
# Two!
```

This is, in fact, roughly how the `if` function works: it takes a list of arguments, runs the first one, and then, if the first argument exits "truthily", runs the second argument (and given more arguments, continues in an "else-if-else" fashion).

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

which should actually look somewhat like syntax.  Many language constructs are built on this, and it's (relatively) easy to build even more (this is part of the "extensible" in "the extensible shell").

Going even *further*, *es* also implements a *lambda calculus* --- that is, in addition to code blocks like `{echo Hello}`, you can specify the *lambda* `@ msg {echo $msg}`, and call it like `@ msg {echo $msg} Hello`.

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

Having a lambda calculus in the language unlocks some powerful stuff, and allows *es* to piggy-back off of the work and constructs of previous lambda-focused languages, like Scheme.

This page doesn't address all of the interesting features of *es*, such as its rich return values, exception mechanism, lexical binding support, and syntax rewriting --- check out the [paper](paper.html) by the original authors for a complete introduction.


[^1]: It would be nice to use the phrase "ongoing improvement" here, but that may be overselling the continuing work.

[^2]: Folks familiar with homoiconicity should recognize what's coming, though note that *es* tends to feel more like Tcl than Scheme in how it does its code-as-data stuff.
