---
title: "useful"
description: "Functions to make es more ergonomic"
date: 2017-07-16T01:41:52-07:00
url: /es/useful.html
---

This is a set of useful *es* functions, which fit nicely in a user's `.esrc`, or `es-autoload` directory (if they've put the [autoload directory](#autoload-directory) functionality in their `.esrc`!).

There are additional example `.esrc` files available with the [source code](https://github.com/wryun/es-shell).

## The quick list

 - [Simple aliasing](#simple-aliasing)
 - [Local SHELL=bash](#local-shell-bash)
 - [Autoload directory](#autoload-directory)
 - [Path caching](#path-caching)
 - [PWD caching](#pwd-caching)
 - [Temporary cd](#temporary-cd)
 - [Streaming input](#streaming-input)

### Simple aliasing

Provides simple aliases, just like more familiar shells.  Handles the infinite recursion case 'automatically'.

```
fn alias name cmd {
  if {~ $name $cmd(1)} {cmd = <={%whatis $cmd(1)} $cmd(2 ...)}
  fn-$name = $cmd
}

# Examples
alias ls    ls --color=auto
alias egrep egrep --color=auto
```

### Local SHELL=bash

Some tools don't behave well with non-POSIX-compliant shells.  This command allows these tools to "transparently" use POSIX syntax, without too much fuss for the *es* user.

```
fn with-bash cmd {
  local (SHELL = <={let (fn-bash = ) %whatis bash}) $cmd
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

Allows for a directory of small *es* utility functions.  Make sure to set the `es-autoload` variable to an appropriate value.

```
es-autoload = ~/bin/es-autoload

let (search = $fn-%pathsearch)
fn %pathsearch prog {
  if {access -f -r $es-autoload/$prog} {
    . -- $es-autoload/$prog
    if {!~ $#(fn-$prog) 0} {
      return $(fn-$prog)
    }
  }
  $search $prog
}
```

### Path caching

Many shells have path caching (or "hashing") support built-in.  *Es* does not, because it can be written purely in *es* itself.

```
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

# When $path is reset, the cache should be invalidated
let (setpath = $set-path)
set-path = @ {
  if {!~ $path-cache ()} {
    recache
  }
  $setpath $*
}
```

### PWD caching

Many shells maintain a `$PWD` environment variable and, by default, simply define the `pwd` command as `echo $PWD`.  *Es* can do this too:

```
let (cd = $fn-cd)
fn cd {
  let (result = <={$cd $*}) {
    local (fn-pwd = ()) PWD = `pwd
    result $result
  }
}

set-PWD = @ {
  PWD-l = <={%fsplit / $*}
  result $*
}
PWD = `pwd
fn-pwd = {echo $PWD}
```

This version also provides a (somewhat awkwardly named) second variable `$CWD-l`, which is the current working directory in a list form -- which may be useful for prompting, or some other purpose.

### Temporary cd

Change directory for a single command (without forking,
though that's a way to do it too).

```
let (cd = $fn-cd)
fn cd dir cmd {
  if {~ $cmd ()} {
    $cd $dir
  } {
    let (wd = `pwd) {
      unwind-protect {
	$cd $dir
	$cmd
      } {
	$cd $wd
      }
    }
  }
}
```

### Streaming input

Give `for-each` a function as an argument, which itself takes a single argument.  `for-each` will call the function once for each line of input it receives, as it receives it (no buffering of input -- great for huge files!).

```
fn-for-each = $&noreturn @ lambda {
  let (line = ())
    while {!~ <={line = <=%read} ()} {$&noreturn $lambda $line}
}

# Example -- print words containing "gnu" as a substring
for-each @ word {
  if {~ $word *gnu*} {echo $word}
} < /usr/share/dict/words
```


---

Go [back](index.html)
