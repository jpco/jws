---
title: "functional es"
description: "It's hard to say why anyone would want functional programming in their shell, but this one has it"
date: 2018-09-11T22:23:00-07:00
url: /blog/functional-es.html
draft: true
---

*The [extensible shell](/es) has several one-of-a-kind features.  This post describes the most unique among them: The ability to operate on code as data in the shell, the same way as other functionally-minded languages provide.*

In *es*, a lambda expression is written in the form `@ param1 param2 { body }`.

A lambda is run when it makes up the first word in a command; the following words are used as its arguments:

```
; @ word1 word2 {echo $word1; echo $word2} first second third
first
second third
```

As in this example, if there are more arguments than parameters, the final parameter set to the full list of remaining arguments.

Lambda expressions can be passed as arguments to functions.  A lambda is a single token.

```
; fn print msg {
    echo printing $msg
  }
; print @ {command}
printing @ * {command}
```

Lambdas with no parameters get an implicit parameter `*`.

Putting this together produces a simple `apply` function (analogous to many languages' `map`):

```
; fn apply lambda args {
    for (arg = $args) {
      $lambda $arg
    }
  }
; apply @ {echo printing $*} zip zap zop
printing zip
printing zap
printing zop
```

Or, given the prior `print` function that was already defined[^1]

[^1]: This is actually also possible with bash, though bash doesn't allow for inline functions or really useful returns, and its splitting rules are always cause for concern.

```
function print {
    echo printing $*
}

function apply {
    cmd=$1
    shift
    for arg in $*; do
        $cmd $arg
    done
}

apply print zip zap zop
```

```
; apply print zip zap zop
printing zip
printing zap
printing zop
```

---

There's an important piece missing here, though.  Return values in *es*, unlike many other shells, can be arbitrary values -- including lists and lambdas.

```
; fn make-list {
    result one two three
  }
; # apply the lambda to the result of calling make-list
; apply @ {echo PRINTING $*} <={make-list}
PRINTING one
PRINTING two
PRINTING three
```

A proper implementation of `apply` needs to handle this properly.  So,

```
fn apply lambda args {
  # set $accum to be the empty list
  let (accum = ()) {
    # for each $arg,
    for (arg = $args) {
      # append to $accum the result of calling $lambda on $arg
      accum = $accum <={$lambda $arg}
    }
    # return the full list
    result $accum
  }
}
```

and there's the full implementation of `apply`!

Seeing it in use, there's

```
; echo <={apply @ {result `{rev <<< $*}} one two three}
eno owt eerht
```

This command states: For each element of `one two three`, reverse the element with `rev`, collect the output of that command, and return it.  Then, take the `apply`-ed output of each of those commands, and `echo` them.
