---
title: "functional es"
description: "It's hard to say why anyone would want functional programming in their shell, but this one has it"
date: 2018-09-11T22:23:00-07:00
url: /blog/functional-es.html
draft: true
---

*The [extensible shell](/es) has several one-of-a-kind features.  This post describes the most unique among them: The ability to operate on code as data in the shell, the same way as other functionally-minded languages provide.*

Nearly every shell already operates on code as data---most just happen to avoid admitting it, so they're bad at it.

Generally, in a shell environment, there are two main types of data.  The first type, pipes and redirections, are used to process streams and control data into and out of files.  People rightfully extoll the power of pipes, being a core component of UNIX and UNIX-based operating systems.  In fact, pipelines can already be considered to have [functional programming](http://okmij.org/ftp/Computation/monadic-shell.html) features built in, given sufficient restrictions on what you want to pass around.  People also rightfully criticize the unstructured nature of data streams and the toil required to map between commands, and [more](https://docs.microsoft.com/en-us/powershell/) [recent](https://elv.sh/) [shell languages](https://www.oilshell.org/) have mechanisms to pass data with at least some amount of structure between commands---but more on this later.

The other main type of data is made up of arguments, which are passed around in variables, and return values.  People rarely extoll the virtues of arguments or return values in shells.  In POSIX shells, return values are limited to small integer values, and variables have a bad habit of being modified when used as arguments, being split and processed in surprising ways.

Shells typically have some way of mapping between file streams and arguments.  In one direction, there is *command substitution*, which makes command output into arguments:

```
echo GOT `echo foo`
```

as well as the handy `xargs` command:

```
cat $LONGFILE | xargs echo 'LINE:'
```

In the other direction, there's, well, `echo` itself.
