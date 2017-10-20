---
title: "useful"
description: "Functions to make es more ergonomic"
date: 2017-07-16T01:41:52-07:00
url: /es/useful.html
---

Here are some handy es functions.  Add them to your configuration to taste.

This is a living doc, for sure, expected to expand. Send in your suggestions.

### Simple alias function

For the simple aliases, just like other shells.  Handles the infinite recursion case 'automatically'.

```es
fn alias name cmd {
    if {~ $name $cmd(1)} {cmd = <={%whatis $cmd(1)} $cmd(2 ...)}
    fn-$name = $cmd
}

# Examples
alias ls    ls --color=auto
alias egrep grep -E --color=auto
```

### Set certain commands to always run with SHELL=bash

```es
fn with-bash cmd {
    local (SHELL = /usr/bin/bash) $cmd
}

let (fn always-with-bash cmd {
    let (def = <={%whatis $cmd})
        fn-$cmd = with-bash $def
}) {
    # Examples
    always-with-bash vim
    always-with-bash ssh
}
```

### Autoload directory

Definitely handy for small "utility" functions you keep running.  Define the function in a file with the same name as the function, put it in the autoload directory, and let 'er rip.

```es
autoload = ~/bin/es-autoload
let (search = $fn-%pathsearch)
fn %pathsearch prog {
    if {access -f -r $autoload/$prog} {
        . -- $autoload/$prog
        if {!~ $#(fn-$prog) 0} {
            return $(fn-$prog)
        }
    }
    $search $prog
}
```

### Path cache

This can be handy if path searching is slow for whatever reason.

NOTE: May be broken? It has exhibited strange behavior for me...

```es
let (search = $fn-%pathsearch)
fn %pathsearch prog {
    let (file = <={$search $prog}) {
        if {~ $#file 1 && ~ $file /*} {
            path-cache = $path-cache $prog
            fn-$prog = $file
        }
        result $file
    }
}

fn recache {
    for (i = $path-cache) {
        fn-$i =
    }
    path-cache =
}
```

## Operate on streaming input

Give `for-each` a function as an argument, which itself takes a single argument.  `for-each` will call the function once for each line of input it receives, as it receives it (no buffering of input -- great for huge files!).

```es
fn-for-each = $&noreturn @ lambda {
    let (line = ())
        while {!~ <={line = <=%read} ()} {$&noreturn $lambda $line}
}
```

---

Go [back](index.html)
