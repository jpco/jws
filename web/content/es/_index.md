---
title: es
description: The extensible shell
---

Es[^1] is a good shell.

If you want a proper introduction to the language, see the [Usenix paper](http://wryun.github.io/es-shell/paper.html) written by the initial designers/implementers of the language.  You can also download and build either the "official" version at [wryun's Github repo](https://github.com/wryun/es-shell) of the language, or [my own fork](https://github.com/jpco/es-shell), which contains some language extensions (and a couple hopefully minor breaking changes).

As a teaser, here are some things you can do with es[^2]:

## Avoid confusing quoting

In posix shells, all variables are strings.  When a variable is used unquoted, it is split according to the value of `$IFS` (and then interpolated -- i.e., variables within the quotes will be replaced with their value).  If double-quoted, it is not split, but will be interpolated.  If single-quoted, it will be neither split nor interpolated.

```
phrase='saving $100'

celebrate() {
    for i in "$@"; do
        echo Celebrate $i!
    done
}

celebrate $phrase    # Celebrate saving!
                     # Celebrate $100!

celebrate "$phrase"  # Celebrate saving $100!
```

Following the proper quoting rules is necessary when both setting and using variables.  This is confusing and leads to errors.

Es variables are lists.  There is only one kind of significant quote, the single quote, which stops both splitting and interpolation.  Also, variables are only split when the values are first read.

```
; name = bob 'big hat' mccoy
; echo $name
bob big hat mccoy

; echo $#name  # the length of $name
3

; echo $name(2)  # the second element of $name (es is one-indexed)
big hat

; fn celebrate {for (i = $*) echo Celebrate $i^!}
; celebrate $name  # no quotes necessary, it does not get re-split
Celebrate bob!
Celebrate big hat!
Celebrate mccoy!
```

This fixes a large class of bugs out of the gate.


## Operate on code as data

Es draws quite a bit from Scheme, and as such, allows for operating on code as data.

The canonical example is the `map` function:

```
fn map cmd args {
    for (arg = $args) {
        $cmd $arg
    }
}

map echo one two three
# echo one
# echo two
# echo three

map @ file {mv $file stash/} file1 file2 file3
# mv file1 stash/
# mv file2 stash/
# mv file3 stash/
```

In the last example, the first argument to `map` is a lambda, using es' `@ arg {body}` syntax.  Lambdas operate exactly like functions, but can be passed around like other values.  In fact, function assignment is just sugar for assigning a lambda to a variable:

```
# The following lines are completely identical
fn celebrate items {echo Keep celebrating $items}
fn-celebrate = @ items {echo Keep celebrating $items}

# Very identical indeed:
fn cool stuff {lots of good commands}
echo $fn-cool
# @ stuff {lots of good commands}
```

Since most shells don't operate on commands in a robust way, it takes a while to dig into how handy it can be, but---trust me---it's *very handy*.


## Redefine (and keep redefining) commands

In most shells, there are aliases.

```
alias egrep='grep -E'
```

In es, there are no aliases, but there don't need to be:
```
fn egrep {
    grep -E $*
}

# or, more briefly,
fn-egrep = grep -E
```

Es functions allow for everything aliases would, plus quite a bit more interesting functionality (no pun intended).  The following block extends the `cd` command to update the value of the `$cwd` variable every time it is called, and overrides `pwd` to simply `echo $cwd`.
```
let (cd = $fn-cd)
fn cd dest {
    $cd $dest
    cwd = `` \n {let (fn-pwd = ()) pwd}
}

fn pwd {echo $cwd}
```

Notice this line: `let (cd = $fn-cd)`.  Since functions are just variables with lambdas as their values, this sets the variable `$cd` to whatever the function `cd` is set to.  This avoids the infinite recursion that would otherwise happen by calling `cd` from within `cd`.

But this also allows you to redefine `cd` further!  Suppose the following code block directly follows the previous:

```
let (cd = $fn-cd)
fn cd dest {
    $cd $dest
    prompt = $cwd^'; '
}
```

This way, the shell's prompt is set to the current working directory every time you run `cd`.  Note that this redefinition of `cd` uses functionality set in the previous redefinition (i.e., setting `$cwd`).

## Redefine (and keep redefining) how the shell itself works

A huge part of the shell's syntax and functionality is exposed as functions, which can be edited.

For syntax, there is typically a three-tier setup: shell syntax

```
a | b | c
```
will be rewritten, when read, in terms of a hook function
```
%pipe {a} 1 0 {b} 1 0 {c}
```
which is usually by default set to a primitive (`fn-%pipe = $&pipe`).  Primitives expose the 'core' functionality of the shell, which can't be defined in terms of other shell constructs.  To change the behavior of pipes, you just redefine the `%pipe` function, exactly like in the previous section.

Some constructs don't even have corresponding primitives, since they don't need them -- `&&`, `||`, and `!` (the hook functions `%and`, `%or`, and `%not`, respectively) are all defined in terms of `if`!

You can also redefine other parts of the shell.  For instance, the behavior of the interactive REPL is defined by the function `%interactive-loop`, and path searching is defined via the `%pathsearch` function.  Both of these (along with others) can be used to do very powerful things, which are mentioned in the [functions list](/es/useful.html).


[^1]: The Extensible Shell

[^2]: These examples include language changes from my own fork of es, so don't be surprised if they break with the version from wryun's repo.

[^3]: The ones and zeros are file descriptors.
